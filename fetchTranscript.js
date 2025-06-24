// fetchTranscript.js - FIXED LRU CACHE VERSION

const { YoutubeTranscript } = require('youtube-transcript');
const axios = require('axios');
const { LRUCache } = require('lru-cache');
require('dotenv').config();

const API_KEY = process.env.YOUTUBE_API_KEY;

// ✅ FIXED: Use LRUCache instead of LRU
const transcriptCache = new LRUCache({
    max: 500, // Maximum 500 cached transcripts (reasonable for most apps)
    ttl: 1000 * 60 * 60 * 24, // 24 hours TTL (YouTube content is fairly stable)
    updateAgeOnGet: true, // Reset TTL when item is accessed
    allowStale: false, // Don't return stale items
    ttlResolution: 1000, // Check TTL every second
    ttlAutopurge: true // Automatically remove expired items
});

// Circuit breaker for API failures
class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000) {
        this.failureThreshold = threshold;
        this.timeout = timeout;
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    }

    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }
}

const apiCircuitBreaker = new CircuitBreaker(5, 30000);

// Enhanced description cleaning with more patterns
function cleanDescription(desc) {
    if (!desc || typeof desc !== 'string') return '';
    
    return desc
        // Remove common section headers and promotional content
        .replace(/\b(?:CHAPTERS|TIMESTAMPS|SPONSORS|AFFILIATE|LINKS|SOCIAL|CONTACT|SUBSCRIBE|FOLLOW|LIKE|COMMENT|SHARE|NOTIFICATION|BELL)\s*:?.*/gmi, '')
        // Remove URLs (more comprehensive)
        .replace(/https?:\/\/(?:[-\w.])+(?:[:\d]+)?(?:\/(?:[\w\/_.])*)?(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?/g, '')
        // Remove email addresses
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
        // Remove promotional codes and IDs
        .replace(/\b(?:CODE|PROMO|DISCOUNT|COUPON)\s*:?\s*[A-Z0-9]{3,}/gi, '')
        // Remove long alphanumeric sequences (likely IDs/codes)
        .replace(/\b[A-Z0-9]{8,}\b/g, '')
        // Remove timestamp patterns
        .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, '')
        // Remove excessive whitespace and empty lines
        .replace(/\n\s*\n+/g, '\n')
        .replace(/^\s+|\s+$/gm, '')
        // Remove social media handles and hashtags
        .replace(/@\w+/g, '')
        .replace(/#\w+(?:\s+#\w+)*/g, '')
        // Remove common promotional phrases
        .replace(/\b(?:don't forget to|make sure to|be sure to)\s+(?:like|subscribe|comment|share|hit the bell).*/gi, '')
        .trim();
}

// Utility function to extract video ID from various YouTube URL formats
function extractVideoId(input) {
    if (!input) return null;
    
    // If it's already just an ID (11 characters)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
        return input;
    }
    
    // Extract from various YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

// Enhanced rate limiter with adaptive delays
class AdaptiveRateLimiter {
    constructor() {
        this.lastCall = 0;
        this.baseInterval = 100; // Base 100ms
        this.currentInterval = this.baseInterval;
        this.maxInterval = 5000; // Max 5 seconds
        this.successCount = 0;
        this.failureCount = 0;
    }

    async wait() {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;
        
        if (timeSinceLastCall < this.currentInterval) {
            await new Promise(resolve => 
                setTimeout(resolve, this.currentInterval - timeSinceLastCall)
            );
        }
        
        this.lastCall = Date.now();
    }

    recordSuccess() {
        this.successCount++;
        this.failureCount = 0;
        
        // Gradually reduce interval on consecutive successes
        if (this.successCount > 3 && this.currentInterval > this.baseInterval) {
            this.currentInterval = Math.max(
                this.baseInterval, 
                this.currentInterval * 0.8
            );
        }
    }

    recordFailure() {
        this.failureCount++;
        this.successCount = 0;
        
        // Increase interval on failures
        this.currentInterval = Math.min(
            this.maxInterval, 
            this.currentInterval * 1.5
        );
    }
}

const rateLimiter = new AdaptiveRateLimiter();

// Enhanced transcript fetching with fallback strategies
async function fetchTranscript(videoInput, options = {}) {
    const {
        useDescription = true,
        cleanDesc = true,
        maxRetries = 3,
        timeout = 15000,
        useCache = true,
        fallbackLanguages = ['en', 'en-US', 'auto']
    } = options;

    const videoId = extractVideoId(videoInput);
    
    if (!videoId) {
        console.error('❌ Invalid video ID or URL provided');
        return { 
            success: false, 
            data: [], 
            source: null, 
            error: 'Invalid video ID',
            videoId: null
        };
    }

    // Check cache first
    if (useCache) {
        const cached = transcriptCache.get(videoId);
        if (cached) {
            console.log(`♻️ Using cached transcript for ${videoId}`);
            return {
                success: true,
                data: cached.data,
                source: cached.source,
                videoId: videoId,
                fromCache: true,
                totalSegments: cached.data.length
            };
        }
    }

    console.log(`🎯 Fetching transcript for video: ${videoId}`);
    
    let lastError = null;
    
    // Strategy 1: Try transcript with multiple languages
    for (const language of fallbackLanguages) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔄 Attempt ${attempt}/${maxRetries} - Language: ${language}`);
                
                const transcriptPromise = language === 'auto' 
                    ? YoutubeTranscript.fetchTranscript(videoId)
                    : YoutubeTranscript.fetchTranscript(videoId, { lang: language });
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Transcript fetch timeout')), timeout)
                );
                
                const transcript = await Promise.race([transcriptPromise, timeoutPromise]);
                
                if (transcript && transcript.length > 0) {
                    const transcriptText = transcript
                        .map(item => ({
                            text: (item.text || '').trim(),
                            start: parseFloat(item.start) || 0,
                            duration: parseFloat(item.duration) || 0
                        }))
                        .filter(item => item.text.length > 0);
                    
                    if (transcriptText.length > 0) {
                        console.log(`✅ Transcript fetched: ${transcriptText.length} segments (${language})`);
                        
                        const result = {
                            success: true,
                            data: transcriptText,
                            source: 'transcript',
                            videoId: videoId,
                            language: language,
                            totalSegments: transcriptText.length
                        };
                        
                        // Cache the result
                        if (useCache) {
                            transcriptCache.set(videoId, {
                                data: transcriptText,
                                source: 'transcript',
                                cachedAt: Date.now()
                            });
                        }
                        
                        rateLimiter.recordSuccess();
                        return result;
                    }
                }
            } catch (transcriptError) {
                lastError = transcriptError;
                console.log(`⚠️ Transcript attempt ${attempt} failed (${language}): ${transcriptError.message}`);
                
                rateLimiter.recordFailure();
                
                if (attempt < maxRetries) {
                    const backoffDelay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
                    console.log(`⏳ Waiting ${backoffDelay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }
            }
        }
    }

    // Strategy 2: Fallback to video description if enabled
    if (useDescription && API_KEY) {
        try {
            console.log('📝 Trying video description fallback...');
            
            await rateLimiter.wait();
            
            const result = await apiCircuitBreaker.execute(async () => {
                const videoUrl = `https://www.googleapis.com/youtube/v3/videos`;
                const params = {
                    part: 'snippet',
                    id: videoId,
                    key: API_KEY
                };
                
                const videoResponse = await axios.get(videoUrl, { 
                    params,
                    timeout,
                    headers: {
                        'User-Agent': 'SmartFetch/1.0'
                    }
                });
                
                return videoResponse;
            });
            
            if (result.data.items && result.data.items.length > 0) {
                let description = result.data.items[0].snippet.description || '';
                const title = result.data.items[0].snippet.title || '';
                const channelTitle = result.data.items[0].snippet.channelTitle || '';
                
                if (cleanDesc) {
                    description = cleanDescription(description);
                }
                
                if (description.length > 100) { // Increased minimum meaningful length
                    const descriptionLines = description
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => 
                            line.length > 10 && 
                            line.length < 1000 && // Filter very long lines
                            !line.match(/^https?:\/\//) // Filter standalone URLs
                        )
                        .slice(0, 50); // Limit to first 50 meaningful lines
                    
                    if (descriptionLines.length > 0) {
                        console.log(`✅ Using video description: ${descriptionLines.length} lines`);
                        
                        const descResult = {
                            success: true,
                            data: descriptionLines,
                            source: 'description',
                            videoId: videoId,
                            title: title,
                            channelTitle: channelTitle,
                            totalLines: descriptionLines.length
                        };
                        
                        // Cache description result
                        if (useCache) {
                            transcriptCache.set(videoId, {
                                data: descriptionLines,
                                source: 'description',
                                cachedAt: Date.now()
                            });
                        }
                        
                        rateLimiter.recordSuccess();
                        return descResult;
                    }
                }
            }
        } catch (descError) {
            console.error(`❌ Description fallback failed: ${descError.message}`);
            lastError = descError;
            rateLimiter.recordFailure();
        }
    } else if (!API_KEY && useDescription) {
        console.log('⚠️ YouTube API key not found, skipping description fallback');
    }

    console.log('❌ No transcript or description available');
    return {
        success: false,
        data: [],
        source: null,
        videoId: videoId,
        error: lastError?.message || 'No content available',
        attempted: {
            transcript: true,
            description: useDescription && !!API_KEY
        }
    };
}

// Enhanced batch processing with better error handling and progress tracking
async function fetchMultipleTranscripts(videoInputs, options = {}) {
    const {
        batchDelay = 1000,
        maxConcurrent = 5,
        progressCallback = null,
        skipErrors = true
    } = options;
    
    const results = [];
    const errors = [];
    
    console.log(`📦 Processing ${videoInputs.length} videos with max ${maxConcurrent} concurrent...`);
    
    // Process in chunks with concurrency control
    for (let i = 0; i < videoInputs.length; i += maxConcurrent) {
        const chunk = videoInputs.slice(i, i + maxConcurrent);
        const chunkNumber = Math.floor(i / maxConcurrent) + 1;
        const totalChunks = Math.ceil(videoInputs.length / maxConcurrent);
        
        console.log(`\n🔄 Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} videos)`);
        
        const chunkPromises = chunk.map(async (videoInput, index) => {
            try {
                // Stagger requests within chunk
                await new Promise(resolve => setTimeout(resolve, index * 200));
                return await fetchTranscript(videoInput, options);
            } catch (error) {
                console.error(`❌ Error processing ${videoInput}: ${error.message}`);
                if (skipErrors) {
                    return {
                        success: false,
                        data: [],
                        source: null,
                        videoId: extractVideoId(videoInput),
                        error: error.message
                    };
                }
                throw error;
            }
        });
        
        const chunkResults = await Promise.allSettled(chunkPromises);
        
        chunkResults.forEach((result, index) => {
            const videoInput = chunk[index];
            
            if (result.status === 'fulfilled') {
                results.push(result.value);
                
                if (progressCallback) {
                    progressCallback({
                        completed: results.length,
                        total: videoInputs.length,
                        current: result.value,
                        videoInput
                    });
                }
            } else {
                const error = {
                    videoInput,
                    error: result.reason.message,
                    timestamp: new Date().toISOString()
                };
                errors.push(error);
                console.error(`❌ Promise rejected for ${videoInput}: ${result.reason.message}`);
            }
        });
        
        // Delay between chunks
        if (i + maxConcurrent < videoInputs.length) {
            console.log(`⏳ Waiting ${batchDelay}ms before next chunk...`);
            await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
    }
    
    const successful = results.filter(r => r.success).length;
    const fromCache = results.filter(r => r.fromCache).length;
    
    console.log(`\n✅ Batch complete: ${successful}/${videoInputs.length} successful`);
    console.log(`♻️ Cache hits: ${fromCache}`);
    
    if (errors.length > 0) {
        console.log(`❌ Errors: ${errors.length}`);
    }
    
    return {
        results,
        errors,
        stats: {
            total: videoInputs.length,
            successful,
            failed: results.filter(r => !r.success).length,
            fromCache,
            processingTime: Date.now()
        }
    };
}

// Utility function to get cache statistics
function getCacheStats() {
    return {
        size: transcriptCache.size,
        max: transcriptCache.max,
        // ✅ FIXED: Updated for lru-cache v7+ API
        hitRate: transcriptCache.calculatedSize / transcriptCache.max || 0,
        totalHits: transcriptCache.size,
        items: transcriptCache.size
    };
}

// Utility function to clear cache
function clearCache() {
    transcriptCache.clear();
    console.log('🗑️ Transcript cache cleared');
}

module.exports = {
    fetchTranscript,
    fetchMultipleTranscripts,
    extractVideoId,
    cleanDescription,
    getCacheStats,
    clearCache,
    CircuitBreaker,
    AdaptiveRateLimiter
};