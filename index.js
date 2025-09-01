// index.js - Enhanced with SmartFetch Integration and Advanced AI Processing

// Validate environment first
const envVars = require('./validateEnv');

const axios = require('axios');
const fetchTranscript = require('./fetchTranscript');
const { extractFromTranscript } = require('./textExtract');
const { EnhancedAIPostProcessor } = require('./aiPostProcessor');


const syncToSheet = require('./syncToSheet');
const config = require('./config');

const API_KEY = process.env.YOUTUBE_API_KEY;

// Enhanced SmartFetch Integration with Advanced AI Processing
// Fixed SmartFetch constructor with proper AI detection logic
class SmartFetch {
    constructor(config = {}) {
        this.config = {
            // AI configuration
            aiEnabled: config.aiEnabled !== false,
            aiProvider: config.aiProvider || 'openai',
            aiApiKey: config.aiApiKey || process.env.AI_API_KEY,
            aiModel: config.aiModel || 'gpt-3.5-turbo',
            
            // Processing thresholds
            acceptThreshold: config.acceptThreshold || 0.6,
            reviewThreshold: config.reviewThreshold || 0.3,
            aiThreshold: config.aiThreshold || 0.4,
            
            // Rate limiting and retry settings
            maxRetries: config.maxRetries || 3,
            timeout: config.timeout || 30000,
            requestsPerMinute: config.requestsPerMinute || 18,
            
            // Enhanced features
            batchProcessing: config.batchProcessing || false,
            failureFile: config.failureFile || 'failed-ai-requests.json'
        };

        // Initialize AI processor and update config based on success
        this.aiProcessor = null;
        this.initializeAI();

        // Processing statistics
        this.stats = {
            totalProcessed: 0,
            accepted: 0,
            rejected: 0,
            needsReview: 0,
            aiEnhanced: 0,
            errors: 0,
            totalProcessingTime: 0,
            aiImprovements: []
        };

        // Batch processing queue
        this.processingQueue = [];
        this.isProcessingBatch = false;
    }

    initializeAI() {
        try {
            // Only attempt AI initialization if explicitly enabled AND we have an API key
            if (this.config.aiEnabled && this.config.aiApiKey) {
                this.aiProcessor = new EnhancedAIPostProcessor({
                    provider: this.config.aiProvider,
                    apiKey: this.config.aiApiKey,
                    model: this.config.aiModel,
                    threshold: this.config.aiThreshold,
                    requestsPerMinute: this.config.requestsPerMinute,
                    failureFile: this.config.failureFile
                });
                
                // Update config to reflect successful AI initialization
                this.config.aiEnabled = true;
                console.log('🤖 Enhanced AI processor initialized successfully');
                
            } else if (this.config.aiEnabled) {
                // AI was requested but no API key available - try basic processor
                this.aiProcessor = new EnhancedAIPostProcessor({
                    provider: this.config.aiProvider,
                    apiKey: this.config.aiApiKey,
                    model: this.config.aiModel,
                    enabled: false, // Disable actual API calls
                    threshold: this.config.aiThreshold
                });
                
                // Keep AI enabled but log the limitation
                console.log('🤖 Basic AI processor initialized (no API key)');
                
            } else {
                // AI explicitly disabled
                this.config.aiEnabled = false;
                console.log('🤖 AI processing disabled by configuration');
            }
            
        } catch (error) {
            console.warn('⚠️ AI processor initialization failed, continuing with regex-only processing');
            console.warn(`   Error: ${error.message}`);
            
            // Set AI as disabled if initialization fails
            this.config.aiEnabled = false;
            this.aiProcessor = null;
        }
    }

    // Add a method to check if AI is actually available
    isAIAvailable() {
        return this.config.aiEnabled && this.aiProcessor !== null;
    }

    async processTranscript(transcript, videoData) {
        const startTime = Date.now();
        
        try {
            // Extract using regex pipeline
            const regexResult = await extractFromTranscript(transcript);
            let finalResult = regexResult;
            
            // Apply AI enhancement if available and needed
            if (this.isAIAvailable() && regexResult.confidence < this.config.aiThreshold) {
                console.log(`🤖 Confidence ${regexResult.confidence.toFixed(2)} < ${this.config.aiThreshold}, applying AI enhancement...`);
                
                const originalText = Array.isArray(transcript) ? transcript.join(' ') : transcript;
                
                finalResult = await this.aiProcessor.processResult(
                    regexResult, 
                    originalText, 
                    videoData.videoId
                );
                
                if (finalResult.aiEnhanced) {
                    this.stats.aiEnhanced++;
                    const improvement = finalResult.confidence - regexResult.confidence;
                    this.stats.aiImprovements.push(improvement);
                    console.log(`🤖 AI enhanced: ${regexResult.confidence.toFixed(2)} → ${finalResult.confidence.toFixed(2)} (+${improvement.toFixed(3)})`);
                }
            }

            // Determine final status
            const status = this.determineStatus(finalResult);
            
            // Update statistics
            this.stats.totalProcessed++;
            this.stats.totalProcessingTime += Date.now() - startTime;
            
            if (status === 'accepted') this.stats.accepted++;
            else if (status === 'rejected') this.stats.rejected++;
            else if (status === 'needs_review') this.stats.needsReview++;

            return {
                ...finalResult,
                status: status,
                processingTimeMs: Date.now() - startTime,
                aiEnhanced: finalResult.aiEnhanced || false
            };

        } catch (error) {
            console.error(`❌ Error processing transcript: ${error.message}`);
            this.stats.errors++;
            
            return {
                codes: [],
                links: [],
                percent_off: [],
                flat_discount: [],
                confidence: 0,
                status: 'error',
                error: error.message,
                processingTimeMs: Date.now() - startTime
            };
        }
    }

    // Enhanced batch processing method
    async processBatch(videosData, batchSize = 5) {
        if (!this.isAIAvailable()) {
            console.log('⚠️ Batch processing requires AI to be enabled and available');
            console.log(`   AI Enabled: ${this.config.aiEnabled}`);
            console.log(`   AI Processor: ${this.aiProcessor ? 'Available' : 'Not Available'}`);
            return [];
        }

        console.log(`🔄 Starting batch processing of ${videosData.length} videos (batch size: ${batchSize})`);
        
        const results = [];
        const startTime = Date.now();

        // Process in batches to manage rate limits
        for (let i = 0; i < videosData.length; i += batchSize) {
            const batch = videosData.slice(i, i + batchSize);
            console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(videosData.length/batchSize)} (${batch.length} videos)`);

            // Process batch concurrently but with rate limiting
            const batchPromises = batch.map(async (videoData, index) => {
                try {
                    // Add staggered delay to prevent rate limit hits
                    await new Promise(resolve => setTimeout(resolve, index * 200));
                    
                    const result = await this.processTranscript(videoData.transcript, videoData);
                    return {
                        videoId: videoData.videoId,
                        success: true,
                        result: result
                    };
                } catch (error) {
                    console.error(`❌ Batch processing failed for ${videoData.videoId}:`, error.message);
                    return {
                        videoId: videoData.videoId,
                        success: false,
                        error: error.message
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Inter-batch delay for rate limiting
            if (i + batchSize < videosData.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        const totalTime = Date.now() - startTime;
        const successful = results.filter(r => r.success).length;
        
        console.log(`✅ Batch processing completed: ${successful}/${videosData.length} successful in ${(totalTime/1000).toFixed(1)}s`);
        
        return results;
    }

    determineStatus(result) {
        if (result.confidence >= this.config.acceptThreshold) {
            return 'accepted';
        } else if (result.confidence >= this.config.reviewThreshold) {
            return 'needs_review';
        } else {
            return 'rejected';
        }
    }

    async getAIProcessingStats() {
        if (this.aiProcessor && typeof this.aiProcessor.getProcessingStats === 'function') {
            return await this.aiProcessor.getProcessingStats();
        }
        return null;
    }

    async printStats() {
        if (this.stats.totalProcessed > 0) {
            console.log(`\n📈 SmartFetch Statistics:`);
            console.log(`   Total processed: ${this.stats.totalProcessed}`);
            console.log(`   Accepted: ${this.stats.accepted} (${(this.stats.accepted/this.stats.totalProcessed*100).toFixed(1)}%)`);
            console.log(`   Needs review: ${this.stats.needsReview} (${(this.stats.needsReview/this.stats.totalProcessed*100).toFixed(1)}%)`);
            console.log(`   Rejected: ${this.stats.rejected} (${(this.stats.rejected/this.stats.totalProcessed*100).toFixed(1)}%)`);
            console.log(`   Errors: ${this.stats.errors}`);
            console.log(`   Avg processing time: ${(this.stats.totalProcessingTime/this.stats.totalProcessed).toFixed(1)}ms`);
            
            if (this.isAIAvailable()) {
                console.log(`   AI enhanced: ${this.stats.aiEnhanced}`);
                if (this.stats.aiImprovements.length > 0) {
                    const avgImprovement = this.stats.aiImprovements.reduce((a, b) => a + b, 0) / this.stats.aiImprovements.length;
                    console.log(`   Avg AI improvement: +${avgImprovement.toFixed(3)} confidence`);
                }
                
                // Get detailed AI stats if available
                const aiStats = await this.getAIProcessingStats();
                if (aiStats) {
                    console.log(`   AI API calls: ${aiStats.totalRequests || 'N/A'}`);
                    console.log(`   AI failures: ${aiStats.failures || 'N/A'}`);
                    console.log(`   Unresolved failures: ${aiStats.unresolvedFailures || 'N/A'}`);
                }
            }
        }
    }
}
// Drop-in replacement for enhanced transcript extraction
async function enhancedExtractFromTranscript(transcriptLines, videoId = 'unknown') {
    // Regular extraction first
    const regularResult = await extractFromTranscript(transcriptLines);
    
    // Enhanced AI processing if confidence is low
    if (regularResult.confidence < 0.4 && process.env.AI_API_KEY) {
        const aiProcessor = new EnhancedAIPostProcessor({
            requestsPerMinute: 20,
            threshold: 0.4,
            apiKey: process.env.AI_API_KEY
        });
        
        const originalText = Array.isArray(transcriptLines) ? transcriptLines.join(' ') : transcriptLines;
        const enhancedResult = await aiProcessor.processResult(regularResult, originalText, videoId);
        
        return enhancedResult;
    }
    
    return regularResult;
}

// Configuration
const VIDEO_LINKS = [
    'https://www.youtube.com/watch?v=_NXYpEMEZPc',
     'https://www.youtube.com/watch?v=ga48uN7y2oQ',
     'https://www.youtube.com/watch?v=QhFihT-pPd4',
     'https://www.youtube.com/watch?v=8oRj4wvomzs',
     
];

const CHANNEL_IDS = [
   // 'UCIPPMRA040LQr5QPyJEbmXA', // MrBeast Gaming
    // Add more channel IDs as needed
];

// Initialize SmartFetch with enhanced configuration
const smartFetch = new SmartFetch({
    aiEnabled: process.env.AI_ENABLED !== 'false', // Enable by default unless explicitly disabled
    aiProvider: 'openai',
    aiApiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY,
    acceptThreshold: 0.6,
    reviewThreshold: 0.3,
    aiThreshold: 0.4,
    requestsPerMinute: 18,
    batchProcessing: process.env.BATCH_PROCESSING === 'true',
    failureFile: 'failed-ai-requests.json'
});

function extractVideoIdFromUrl(url) {
    try {
        const short = url.match(/youtu\.be\/([^\?\&]+)/);
        if (short) return short[1];
        const long = url.match(/[?&]v=([^&]+)/);
        if (long) return long[1];
        const shorts = url.match(/shorts\/([^\?\&]+)/);
        if (shorts) return shorts[1];
        return null;
    } catch (error) {
        console.error(`Error extracting video ID from ${url}:`, error.message);
        return null;
    }
}

async function fetchChannelVideos(channelId, maxResults = 10) {
    try {
        console.log(`🔍 Fetching videos from channel: ${channelId}`);
        
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${API_KEY}`;
        
        const response = await axios.get(searchUrl);
        
        if (response.data.items && response.data.items.length > 0) {
            console.log(`✅ Found ${response.data.items.length} videos from channel ${channelId}`);
            return response.data.items.map(item => item.id.videoId);
        } else {
            console.log(`⚠️ No videos found for channel: ${channelId}`);
            return [];
        }
        
    } catch (error) {
        console.error(`❌ Error fetching videos from channel ${channelId}:`, error.message);
        if (error.response) {
            console.error(`API Response:`, error.response.data);
        }
        return [];
    }
}

async function validateVideoExists(videoId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
        const response = await axios.get(url);
        return response.data.items && response.data.items.length > 0;
    } catch (error) {
        console.error(`❌ Error validating video ${videoId}:`, error.message);
        return false;
    }
}

async function fetchVideoDetails(videoId) {
    try {
        // Validate video exists first
        const exists = await validateVideoExists(videoId);
        if (!exists) {
            console.log(`⚠️ Video ${videoId} does not exist or is not accessible`);
            return null;
        }

        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
        const response = await axios.get(url);
        
        if (response.data.items && response.data.items.length > 0) {
            const video = response.data.items[0];
            console.log(`📹 Video: ${video.snippet.title}`);
            
            // Fetch transcript
            console.log(`🎯 Fetching transcript for video: ${videoId}`);
            const transcript = await fetchTranscript(videoId);
            
            if (transcript.length > 0) {
                console.log(`✅ Transcript found: ${transcript.length} lines`);
                
                // Process transcript using SmartFetch
                console.log(`🧠 Processing with SmartFetch...`);
                const videoData = {
                    videoId: videoId,
                    videoTitle: video.snippet.title,
                    channelTitle: video.snippet.channelTitle,
                    publishedAt: video.snippet.publishedAt,
                    description: video.snippet.description || ''
                };
                
                const processingResult = await smartFetch.processTranscript(transcript, videoData);
                
                console.log(`📊 Processing result:`, {
                    status: processingResult.status,
                    confidence: processingResult.confidence?.toFixed(2),
                    codes: processingResult.codes?.length || 0,
                    links: processingResult.links?.length || 0,
                    aiEnhanced: processingResult.aiEnhanced,
                    processingTime: `${processingResult.processingTimeMs}ms`
                });
                
                if (processingResult.codes.length > 0 || processingResult.links.length > 0) {
                    const finalVideoData = {
                        videoId: videoId,
                        videoTitle: video.snippet.title,
                        channelTitle: video.snippet.channelTitle,
                        publishedAt: video.snippet.publishedAt,
                        timestamp: new Date().toISOString(),
                        ...processingResult
                    };
                    
                    console.log(`💾 Saving data for video: ${videoId}`);
                    console.log(`   - Status: ${processingResult.status}`);
                    console.log(`   - Codes found: ${processingResult.codes.length}`);
                    console.log(`   - Links found: ${processingResult.links.length}`);
                    console.log(`   - Confidence: ${processingResult.confidence?.toFixed(2) || 'N/A'}`);
                    if (processingResult.aiEnhanced) {
                        console.log(`   - AI Enhanced: Yes`);
                    }
                    
                    // Sync to Google Sheets
                    try {
                        await syncToSheet(finalVideoData);
                        return finalVideoData;
                    } catch (sheetError) {
                        console.error(`❌ Failed to sync to Google Sheets: ${sheetError.message}`);
                        return finalVideoData;
                    }
                } else {
                    console.log(`⚠️ No codes or links found in video: ${videoId} (Status: ${processingResult.status})`);
                    return null;
                }
            } else {
                console.log(`⚠️ No transcript available for video: ${videoId}`);
                return null;
            }
        }
        
    } catch (err) {
        console.error(`❌ Error processing video ${videoId}:`, err.message);
        return null;
    }
}

// Enhanced batch processing pipeline
async function processVideosBatch(videoIds, batchSize = 3) {
    console.log(`🔄 Starting batch processing of ${videoIds.length} videos`);
    
    const videosData = [];
    const results = [];
    
    // First, collect all video data and transcripts
    for (const videoId of videoIds) {
        try {
            const exists = await validateVideoExists(videoId);
            if (!exists) continue;

            const videoResponse = await axios.get(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`
            );
            
            if (videoResponse.data.items?.length > 0) {
                const video = videoResponse.data.items[0];
                const transcript = await fetchTranscript(videoId);
                
                if (transcript.length > 0) {
                    videosData.push({
                        videoId,
                        transcript,
                        videoTitle: video.snippet.title,
                        channelTitle: video.snippet.channelTitle,
                        publishedAt: video.snippet.publishedAt,
                        description: video.snippet.description || ''
                    });
                }
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error(`❌ Error collecting data for ${videoId}:`, error.message);
        }
    }
    
    // Process using batch method if available
    if (smartFetch.config.batchProcessing && videosData.length > 1) {
        const batchResults = await smartFetch.processBatch(videosData, batchSize);
        
        // Save successful results
        for (const result of batchResults) {
            if (result.success && (result.result.codes.length > 0 || result.result.links.length > 0)) {
                const videoData = videosData.find(v => v.videoId === result.videoId);
                const finalData = {
                    ...videoData,
                    ...result.result,
                    timestamp: new Date().toISOString()
                };
                
                try {
                    await syncToSheet(finalData);
                    results.push(finalData);
                } catch (error) {
                    console.error(`❌ Failed to sync ${result.videoId}:`, error.message);
                }
            }
        }
    } else {
        // Process individually
        for (const videoData of videosData) {
            const result = await fetchVideoDetails(videoData.videoId);
            if (result) results.push(result);
            
            // Rate limiting between individual processes
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return results;
}

async function runAll() {
    try {
        console.log('🚀 Starting Enhanced SmartFetch with Advanced AI Processing...');
        console.log(`🧠 AI Processing: ${smartFetch.isAIAvailable() ? 'Enabled & Available' : 'Disabled or Unavailable'}`);
        console.log(`📦 Batch Processing: ${smartFetch.config.batchProcessing ? 'Enabled' : 'Disabled'}`);
        console.log(`⚡ Rate Limit: ${smartFetch.config.requestsPerMinute} requests/min`);
        
        // Add detailed AI status
        if (smartFetch.isAIAvailable()) {
            console.log(`   🔑 API Key: ${smartFetch.config.aiApiKey ? 'Available' : 'Missing'}`);
            console.log(`   🤖 Model: ${smartFetch.config.aiModel}`);
            console.log(`   📊 AI Threshold: ${smartFetch.config.aiThreshold}`);
        } else {
            console.log(`   ⚠️ AI unavailable - processing will use regex only`);
        }
        
        const videoIds = new Set();
        
        // Process individual video links
        for (const url of VIDEO_LINKS) {
            try {
                const videoId = extractVideoIdFromUrl(url);
                if (videoId) {
                    videoIds.add(videoId);
                } else {
                    console.warn(`⚠️ Could not extract video ID from URL: ${url}`);
                }
            } catch (error) {
                console.error(`Error processing URL ${url}:`, error.message);
            }
        }
        
        // Process channels to get recent videos
        console.log(`🎯 Processing ${CHANNEL_IDS.length} channels...`);
        
        for (const channelId of CHANNEL_IDS) {
            try {
                console.log(`\n📺 Processing channel: ${channelId}`);
                const channelVideoIds = await fetchChannelVideos(channelId, 5);
                
                // Add channel videos to our set
                channelVideoIds.forEach(id => videoIds.add(id));
                
                // Rate limiting between channels
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`❌ Error processing channel ${channelId}:`, error.message);
            }
        }
        
        console.log(`\n📝 Processing ${videoIds.size} total videos...`);
        
        const videoIdsArray = Array.from(videoIds);
        let processedResults = [];
        
        // Use batch processing if enabled and we have multiple videos
        if (smartFetch.config.batchProcessing && videoIdsArray.length > 1) {
            processedResults = await processVideosBatch(videoIdsArray, 3);
        } else {
            // Process each video individually
            let processedCount = 0;
            for (const id of videoIds) {
                processedCount++;
                console.log(`\n🎯 [${processedCount}/${videoIds.size}] Processing video: ${id}`);
                const result = await fetchVideoDetails(id);
                if (result) processedResults.push(result);
                
                // Rate limiting delay
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Print final statistics
        await smartFetch.printStats();
        
        console.log('\n✅ Enhanced SmartFetch completed successfully');
        console.log(`📊 Total videos processed: ${videoIds.size}`);
        console.log(`💾 Results saved: ${processedResults.length}`);
        
        // Show breakdown of results
        const accepted = processedResults.filter(r => r.status === 'accepted').length;
        const needsReview = processedResults.filter(r => r.status === 'needs_review').length;
        const aiEnhanced = processedResults.filter(r => r.aiEnhanced).length;
        
        console.log(`   - Accepted: ${accepted}`);
        console.log(`   - Needs Review: ${needsReview}`);
        console.log(`   - AI Enhanced: ${aiEnhanced}`);
        
    } catch (error) {
        console.error('❌ Error in runAll:', error.message);
    }
}

// Export for potential use as module
module.exports = {
    SmartFetch,
    runAll,
    fetchVideoDetails,
    fetchChannelVideos,
    processVideosBatch,
    enhancedExtractFromTranscript
};

// Run immediately if this file is executed directly
if (require.main === module) {
    runAll();
}