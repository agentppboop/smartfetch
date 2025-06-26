// aiPostProcessor.js - Enhanced version with rate limiting and failure tracking

const fs = require('fs').promises;
const path = require('path');

class RateLimitedQueue {
    constructor(options = {}) {
        this.requestsPerMinute = options.requestsPerMinute || 20; // Conservative limit
        this.requests = [];
        this.processing = false;
        this.onSuccess = options.onSuccess || (() => {});
        this.onError = options.onError || (() => {});
    }

    async add(fn, metadata = {}) {
        return new Promise((resolve, reject) => {
            this.requests.push({
                fn,
                resolve,
                reject,
                metadata,
                timestamp: Date.now()
            });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.requests.length === 0) return;
        
        this.processing = true;
        
        while (this.requests.length > 0) {
            const request = this.requests.shift();
            
            try {
                // Rate limiting: ensure we don't exceed requests per minute
                const now = Date.now();
                const oneMinuteAgo = now - 60000;
                
                // Remove old requests from tracking
                this.recentRequests = (this.recentRequests || []).filter(time => time > oneMinuteAgo);
                
                // If we're at the limit, wait
                if (this.recentRequests.length >= this.requestsPerMinute) {
                    const oldestRequest = Math.min(...this.recentRequests);
                    const waitTime = oldestRequest + 60000 - now + 1000; // Add 1s buffer
                    console.log(`🕐 Rate limit reached, waiting ${Math.ceil(waitTime/1000)}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
                // Execute the request
                this.recentRequests = this.recentRequests || [];
                this.recentRequests.push(Date.now());
                
                const result = await request.fn();
                request.resolve(result);
                this.onSuccess(request.metadata);
                
            } catch (error) {
                request.reject(error);
                this.onError(error, request.metadata);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.processing = false;
    }
}

class FailureTracker {
    constructor(failureFile = 'failed-ai-requests.json') {
        this.failureFile = failureFile;
    }

    async logFailure(videoId, prompt, error, metadata = {}) {
        try {
            let failures = [];
            
            // Try to read existing failures
            try {
                const data = await fs.readFile(this.failureFile, 'utf8');
                failures = JSON.parse(data);
            } catch (err) {
                // File doesn't exist or is invalid, start fresh
                console.log('📝 Creating new failure log file');
            }

            const failureEntry = {
                videoId,
                prompt,
                error: error.message,
                timestamp: new Date().toISOString(),
                retryCount: 0,
                metadata
            };

            failures.push(failureEntry);
            
            await fs.writeFile(this.failureFile, JSON.stringify(failures, null, 2));
            console.log(`📝 Logged failure for video ${videoId}`);
            
        } catch (err) {
            console.error('❌ Failed to log failure:', err.message);
        }
    }

    async getFailures() {
        try {
            const data = await fs.readFile(this.failureFile, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            return [];
        }
    }

    async markRetried(videoId, success = false) {
        try {
            const failures = await this.getFailures();
            const updated = failures.map(failure => {
                if (failure.videoId === videoId) {
                    return {
                        ...failure,
                        retryCount: (failure.retryCount || 0) + 1,
                        lastRetry: new Date().toISOString(),
                        resolved: success
                    };
                }
                return failure;
            });
            
            await fs.writeFile(this.failureFile, JSON.stringify(updated, null, 2));
        } catch (err) {
            console.error('❌ Failed to mark retry:', err.message);
        }
    }

    async clearResolved() {
        try {
            const failures = await this.getFailures();
            const unresolved = failures.filter(f => !f.resolved);
            await fs.writeFile(this.failureFile, JSON.stringify(unresolved, null, 2));
            console.log(`🧹 Cleared ${failures.length - unresolved.length} resolved failures`);
        } catch (err) {
            console.error('❌ Failed to clear resolved failures:', err.message);
        }
    }
}

class EnhancedAIPostProcessor {
    constructor(config = {}) {
        this.config = {
            provider: config.provider || 'openai',
            apiKey: config.apiKey || process.env.OPENAI_API_KEY,
            model: config.model || 'gpt-3.5-turbo',
            enabled: config.enabled !== false,
            threshold: config.threshold || 0.4,
            timeout: config.timeout || 15000,
            requestsPerMinute: config.requestsPerMinute || 20, // Conservative limit
            failureFile: config.failureFile || 'failed-ai-requests.json'
        };

        // Initialize rate limiter and failure tracker
        this.queue = new RateLimitedQueue({
            requestsPerMinute: this.config.requestsPerMinute,
            onSuccess: (metadata) => console.log(`✅ AI processed video ${metadata.videoId}`),
            onError: (error, metadata) => console.log(`❌ AI failed for video ${metadata.videoId}: ${error.message}`)
        });
        
        this.failureTracker = new FailureTracker(this.config.failureFile);
    }

    shouldProcess(result) {
        if (!this.config.enabled) return false;
        if (!result || typeof result.confidence !== 'number') return false;
        return result.confidence < this.config.threshold;
    }

    generatePrompt(result, originalText) {
        return `Analyze this YouTube video content for promotional/coupon codes and affiliate marketing.

EXTRACTED DATA:
- Codes found: ${JSON.stringify(result.codes || [])}
- Code confidence: ${JSON.stringify(result.codeConfidence || {})}
- Percentage discounts: ${JSON.stringify(result.percent_off || [])}
- Flat discounts: ${JSON.stringify(result.flat_discount || [])}
- Links: ${JSON.stringify(result.links || [])}
- Current confidence: ${result.confidence}

SAMPLE TEXT (first 800 chars):
"${originalText ? originalText.substring(0, 800) : 'N/A'}"

TASK:
1. Determine if the extracted codes are likely valid promotional/coupon codes
2. Assess if this appears to be sponsored/promotional content
3. Rate confidence from 0.0 to 1.0 where:
   - 0.8+ = Definitely promotional with valid codes
   - 0.5-0.8 = Likely promotional, codes need verification  
   - 0.2-0.5 = Possibly promotional, weak signals
   - 0.0-0.2 = Not promotional content

RESPOND WITH JSON ONLY:
{
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "validCodes": ["list of codes that seem valid"],
  "isPromotional": true/false,
  "recommendation": "accept/review/reject"
}`;
    }

    async makeOpenAIRequest(prompt) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert at identifying promotional content and coupon codes in YouTube videos. Respond only with valid JSON.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 400
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    parseAIResponse(responseText) {
        try {
            let cleanResponse = responseText.trim();
            if (cleanResponse.startsWith('```json')) {
                cleanResponse = cleanResponse.replace(/```json\n?/, '').replace(/\n?```$/, '');
            }
            if (cleanResponse.startsWith('```')) {
                cleanResponse = cleanResponse.replace(/```\n?/, '').replace(/\n?```$/, '');
            }

            const parsed = JSON.parse(cleanResponse);
            
            if (typeof parsed.confidence !== 'number' || 
                parsed.confidence < 0 || parsed.confidence > 1) {
                throw new Error('Invalid confidence value');
            }

            return {
                confidence: parsed.confidence,
                reasoning: parsed.reasoning || 'No reasoning provided',
                validCodes: Array.isArray(parsed.validCodes) ? parsed.validCodes : [],
                isPromotional: Boolean(parsed.isPromotional),
                recommendation: parsed.recommendation || 'review'
            };
        } catch (error) {
            console.log('⚠️ Error parsing AI response:', error.message);
            return null;
        }
    }

    async processResult(result, originalText = '', videoId = 'unknown') {
        if (!this.shouldProcess(result)) {
            console.log(`🤖 AI processing skipped for ${videoId} - criteria not met`);
            return result;
        }

        console.log(`🤖 Queuing AI processing for video ${videoId}...`);
        
        try {
            const prompt = this.generatePrompt(result, originalText);
            
            // Add to rate-limited queue
            const responseText = await this.queue.add(
                () => this.makeOpenAIRequest(prompt),
                { videoId, prompt }
            );

            const aiResult = this.parseAIResponse(responseText);
            
            if (aiResult) {
                console.log(`🤖 AI assessment for ${videoId}: ${aiResult.confidence.toFixed(2)} confidence`);
                
                const enhancedResult = {
                    ...result,
                    confidence: aiResult.confidence,
                    aiEnhanced: true,
                    aiReasoning: aiResult.reasoning,
                    aiValidCodes: aiResult.validCodes,
                    aiRecommendation: aiResult.recommendation,
                    originalConfidence: result.confidence
                };

                if (aiResult.validCodes.length > 0) {
                    enhancedResult.codes = result.codes.filter(code => 
                        aiResult.validCodes.includes(code)
                    );
                }

                return enhancedResult;
            } else {
                throw new Error('Failed to parse AI response');
            }

        } catch (error) {
            console.log(`⚠️ AI processing failed for ${videoId}:`, error.message);
            
            // Log failure for later retry
            await this.failureTracker.logFailure(
                videoId, 
                this.generatePrompt(result, originalText), 
                error,
                { confidence: result.confidence, timestamp: Date.now() }
            );
            
            return result; // Return original result on error
        }
    }

    async processBatch(resultsWithData, batchSize = 10) {
        const processedResults = [];
        
        console.log(`🚀 Processing ${resultsWithData.length} results in batches of ${batchSize}`);
        
        for (let i = 0; i < resultsWithData.length; i += batchSize) {
            const batch = resultsWithData.slice(i, i + batchSize);
            console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(resultsWithData.length/batchSize)}`);
            
            const batchPromises = batch.map(({ result, originalText, videoId }, index) => 
                this.processResult(result, originalText, videoId || `batch-${i + index}`)
            );
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            batchResults.forEach((settledResult, index) => {
                if (settledResult.status === 'fulfilled') {
                    processedResults.push(settledResult.value);
                } else {
                    console.error(`❌ Batch item ${i + index} failed:`, settledResult.reason.message);
                    processedResults.push(batch[index].result); // Use original result
                }
            });
        }
        
        return processedResults;
    }

    async getProcessingStats() {
        const failures = await this.failureTracker.getFailures();
        const unresolved = failures.filter(f => !f.resolved);
        
        return {
            totalFailures: failures.length,
            unresolvedFailures: unresolved.length,
            queueLength: this.queue.requests.length,
            recentRequests: (this.queue.recentRequests || []).length
        };
    }
}

module.exports = {
    EnhancedAIPostProcessor,
    FailureTracker,
    RateLimitedQueue
};