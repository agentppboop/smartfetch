// index.js - ADVANCED PARALLEL PROCESSING WITH OPTIMIZATION

// Validate environment first
const envVars = require('./validateEnv');

const axios = require('axios');
const { fetchTranscript, fetchMultipleTranscripts } = require('./fetchTranscript');
const { extractFromTranscript } = require('./textExtract');
const syncToSheet = require('./syncToSheet');
const config = require('./config');
const EventEmitter = require('events');

const API_KEY = process.env.YOUTUBE_API_KEY;

// Add after the imports section
function validateChannelIds(channelIds) {
  const valid = [];
  const invalid = [];

  channelIds.forEach(id => {
    if (typeof id === 'string' && id.startsWith('UC') && id.length === 24) {
      valid.push(id);
    } else {
      console.warn(`⚠️ Invalid channel ID: ${id} (must start with 'UC' and be 24 characters)`);
      invalid.push(id);
    }
  });

  if (invalid.length > 0) {
    console.log(`📋 Channel validation: ${valid.length}/${channelIds.length} valid channels`);
  }

  return valid;
}

// Add after your imports
function sanitizeChannelId(id) {
  // Remove any characters not allowed in YouTube channel IDs and trim to 24 chars
  return (id || '').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 24);
}

// Enhanced validation: strictly enforce format
function isStrictlyValidChannelId(id) {
  return typeof id === 'string' && /^UC[a-zA-Z0-9_-]{22}$/.test(id);
}



// Add this function to your index.js
async function validateVideosExist(videoIds) {
  console.log(`🔍 Validating ${videoIds.length} video IDs...`);
  
  const validVideos = [];
  const invalidVideos = [];
  
  // Process in batches to avoid API limits
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    
    try {
      await rateLimiter.wait();
      
      const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'id',
          id: batch.join(','),
          key: API_KEY
        },
        timeout: 10000
      });
      
      const foundIds = response.data.items.map(item => item.id);
      validVideos.push(...foundIds);
      
      // Find missing IDs
      const missingIds = batch.filter(id => !foundIds.includes(id));
      invalidVideos.push(...missingIds);
      
      rateLimiter.recordSuccess();
      
    } catch (error) {
      console.error(`❌ Error validating batch: ${error.message}`);
      rateLimiter.recordError(error.response?.status === 403 ? 'quota_exceeded' : 'generic');
      
      // Assume all are valid if validation fails
      validVideos.push(...batch);
    }
  }
  
  console.log(`✅ Validation complete: ${validVideos.length}/${videoIds.length} valid videos`);
  return { validVideos, invalidVideos };
}

class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
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
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}

// Initialize circuit breaker
const apiCircuitBreaker = new CircuitBreaker(5, 60000);

// Add to your system
const { Pool } = require('pg');

class DatabaseManager {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000
    });
  }

  async batchInsertVideos(videoDataArray) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const data of videoDataArray) {
        await client.query(`
          INSERT INTO video_results (
            video_id, video_title, channel_id, timestamp,
            links, codes, percent_off, flat_discount, confidence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (video_id) DO UPDATE SET
            timestamp = EXCLUDED.timestamp,
            links = EXCLUDED.links,
            codes = EXCLUDED.codes,
            confidence = EXCLUDED.confidence
        `, [
          data.videoId, data.videoTitle, data.channelId,
          data.timestamp, JSON.stringify(data.links),
          JSON.stringify(data.codes), JSON.stringify(data.percent_off),
          JSON.stringify(data.flat_discount), data.confidence
        ]);
      }
      
      await client.query('COMMIT');
      return { success: true, processed: videoDataArray.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}


// ADVANCED PARALLEL PROCESSING CONFIGURATION
const PROCESSING_CONFIG = {
    // Concurrency limits
    MAX_CONCURRENT_VIDEOS: parseInt(process.env.MAX_CONCURRENT_VIDEOS) || 8,
    MAX_CONCURRENT_CHANNELS: parseInt(process.env.MAX_CONCURRENT_CHANNELS) || 4,
    MAX_CONCURRENT_TRANSCRIPTS: parseInt(process.env.MAX_CONCURRENT_TRANSCRIPTS) || 6,
    
    // Batch processing
    VIDEO_BATCH_SIZE: 20,
    SHEET_BATCH_SIZE: 10,
    
    // Rate limiting and delays
    RATE_LIMITS: {
        BETWEEN_VIDEOS: 300,      // ms between individual video requests
        BETWEEN_CHANNELS: 800,    // ms between channel requests
        API_QUOTA_DELAY: 150,     // ms between API calls
        BACKOFF_MULTIPLIER: 1.5,  // Exponential backoff multiplier
        MAX_BACKOFF: 30000        // Maximum backoff delay (30s)
    },
    
    // Retry configuration
    MAX_RETRIES: 3,
    RETRY_DELAY_BASE: 1000,
    
    // Memory and performance
    MEMORY_CHECK_INTERVAL: 30000, // Check memory every 30s
    MAX_MEMORY_MB: 512,           // Max memory usage in MB
    GC_THRESHOLD: 0.8             // Trigger GC when memory usage > 80%
};

// Performance monitoring class
class PerformanceMonitor extends EventEmitter {
    constructor() {
        super();
        this.stats = {
            startTime: Date.now(),
            videosProcessed: 0,
            successfulExtractions: 0,
            failedExtractions: 0,
            cacheHits: 0,
            apiCalls: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0,
            memoryUsage: { rss: 0, heapUsed: 0, heapTotal: 0 }
        };
        
        this.startMemoryMonitoring();
    }

    startMemoryMonitoring() {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            this.stats.memoryUsage = memUsage;
            
            const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
            
            if (heapUsedMB > PROCESSING_CONFIG.MAX_MEMORY_MB * PROCESSING_CONFIG.GC_THRESHOLD) {
                console.log(`⚠️ High memory usage: ${heapUsedMB.toFixed(2)}MB - Triggering GC`);
                if (global.gc) {
                    global.gc();
                } else {
                    console.log('💡 Run with --expose-gc flag to enable manual garbage collection');
                }
            }
            
            this.emit('memoryUpdate', memUsage);
        }, PROCESSING_CONFIG.MEMORY_CHECK_INTERVAL);
    }

    recordVideoProcessed(success, processingTime) {
        this.stats.videosProcessed++;
        this.stats.totalProcessingTime += processingTime;
        this.stats.averageProcessingTime = this.stats.totalProcessingTime / this.stats.videosProcessed;
        
        if (success) {
            this.stats.successfulExtractions++;
        } else {
            this.stats.failedExtractions++;
        }
    }

    recordCacheHit() {
        this.stats.cacheHits++;
    }

    recordApiCall() {
        this.stats.apiCalls++;
    }

    getStats() {
        const runtime = Date.now() - this.stats.startTime;
        return {
            ...this.stats,
            runtime,
            videosPerSecond: (this.stats.videosProcessed / (runtime / 1000)).toFixed(2),
            successRate: (this.stats.successfulExtractions / this.stats.videosProcessed * 100).toFixed(2),
            memoryUsageMB: {
                rss: (this.stats.memoryUsage.rss / 1024 / 1024).toFixed(2),
                heapUsed: (this.stats.memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
                heapTotal: (this.stats.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)
            }
        };
    }

    printStats() {
        const stats = this.getStats();
        console.log(`\n📊 Performance Statistics:`);
        console.log(`   Runtime: ${(stats.runtime / 1000).toFixed(2)}s`);
        console.log(`   Videos processed: ${stats.videosProcessed}`);
        console.log(`   Success rate: ${stats.successRate}%`);
        console.log(`   Processing speed: ${stats.videosPerSecond} videos/second`);
        console.log(`   Average processing time: ${stats.averageProcessingTime.toFixed(2)}ms`);
        console.log(`   Cache hits: ${stats.cacheHits}`);
        console.log(`   API calls: ${stats.apiCalls}`);
        console.log(`   Memory usage: ${stats.memoryUsageMB.heapUsed}MB / ${stats.memoryUsageMB.heapTotal}MB`);
    }
}

// Enhanced Memory Manager - add after PerformanceMonitor class
class EnhancedMemoryManager {
  constructor(maxMB = 512) {
    this.maxMB = maxMB;
    this.checkInterval = 30000; // 30 seconds
    this.warningThreshold = 0.8; // 80% of max
    this.criticalThreshold = 0.9; // 90% of max
    this.startMonitoring();
  }

  startMonitoring() {
    setInterval(() => {
      this.checkMemory();
    }, this.checkInterval);
  }

  checkMemory() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    
    if (heapUsedMB > this.maxMB * this.criticalThreshold) {
      console.log(`🚨 CRITICAL memory usage: ${heapUsedMB.toFixed(2)}MB/${this.maxMB}MB`);
      this.emergencyCleanup();
    } else if (heapUsedMB > this.maxMB * this.warningThreshold) {
      console.log(`⚠️ High memory usage: ${heapUsedMB.toFixed(2)}MB/${this.maxMB}MB`);
      this.performCleanup();
    }
  }

  performCleanup() {
    // Clear channel video cache
    if (typeof channelVideoCache !== 'undefined') {
      channelVideoCache.clear();
    }
    
    // Clear transcript cache if available
    if (typeof transcriptCache !== 'undefined') {
      transcriptCache.clear();
    }
    
    console.log('🧹 Memory cleanup performed');
  }

  emergencyCleanup() {
    this.performCleanup();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🗑️ Emergency garbage collection triggered');
    } else {
      console.log('💡 Run with --expose-gc flag to enable manual garbage collection');
    }
  }

  getMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
      rss: (memUsage.rss / 1024 / 1024).toFixed(2),
      external: (memUsage.external / 1024 / 1024).toFixed(2)
    };
  }
}

// Initialize enhanced memory manager
const memoryManager = new EnhancedMemoryManager(
  parseInt(process.env.MEMORY_LIMIT_MB) || 512
);

// Adaptive Rate Limiter - add after EnhancedMemoryManager
class AdaptiveRateLimiter {
  constructor(baseDelay = 200) {
    this.baseDelay = baseDelay;
    this.currentDelay = baseDelay;
    this.successCount = 0;
    this.errorCount = 0;
    this.lastCall = 0;
    this.consecutiveErrors = 0;
  }

  async wait() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.currentDelay) {
      const waitTime = this.currentDelay - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastCall = Date.now();
  }

  recordSuccess() {
    this.successCount++;
    this.consecutiveErrors = 0;
    
    // Gradually reduce delay on consecutive successes
    if (this.successCount % 5 === 0) {
      this.currentDelay = Math.max(this.baseDelay, this.currentDelay * 0.9);
    }
  }

  recordError(errorType = 'generic') {
    this.errorCount++;
    this.consecutiveErrors++;
    this.successCount = 0;
    
    // Increase delay based on error type and consecutive errors
    let multiplier = 1.5;
    if (errorType === 'rate_limit' || errorType === '429') {
      multiplier = 2.0;
    } else if (errorType === 'quota_exceeded' || errorType === '403') {
      multiplier = 3.0;
    }
    
    this.currentDelay = Math.min(
      30000, // Max 30 seconds
      this.currentDelay * multiplier * (1 + this.consecutiveErrors * 0.1)
    );
    
    console.log(`⚠️ Rate limiter adjusted: ${this.currentDelay}ms delay after ${errorType} error`);
  }

  getStats() {
    return {
      currentDelay: this.currentDelay,
      successCount: this.successCount,
      errorCount: this.errorCount,
      consecutiveErrors: this.consecutiveErrors
    };
  }
}

// Initialize rate limiter
const rateLimiter = new AdaptiveRateLimiter(
  parseInt(process.env.API_DELAY_MS) || 200
);


const performanceMonitor = new PerformanceMonitor();

// Configuration
const VIDEO_LINKS = [
    // Individual video URLs (add your URLs here)
];

const CHANNEL_IDS = [
    'UCIPPMRA040LQr5QPyJEbmXA', // MrBeast Gaming
    'UCX6OQ3DkcsbYNE6H8uQQuVA', // MrBeast main channel
    'UCjmJDM5pRKbUlVIzDYYWb6g', // Gaming channels
    'UC7_YxT-KID8kRbqZo7MyscQ',
    'UCke6I9N4KfC968-yRcd5YRg',
    'UCq-Fj5jknLsUf-MWSy4_brA',
    'UCMiJRAwDNSNzuYeN2uWa0pA', // Tech review channels
    'UCzlXf-yUIaOpOjEjPrOO9TA',
    'UCOmcA3f_RrH6b9NmcNa4tdg',
    'UC6107grRI4m0o2-emgoDnAA',
    'UCXuqSBlHAE6Xw-yeJA0Tunw',
    'UC5Qbo0AR3CwpmEq751BIy0g', // Deal/coupon channels
    'UCnzjNQQOosDeUBa2MUmTV3g',
    'UC8Q7XEy86Q7T-3kNpNjYgwA',
    'UCBJycsmduvYEL83R_U4JriQ',
    'UC7RZRFCrN4XKoMsy5MgJKrg', // Affiliate marketing channels
    'UCuVoO3TArgovwAeWhY1TVSA',
    'UCMQapqmTjEIBNK6_a5H_4Qg',
    'UC2aQkrg2-Nh5rIITzNe8D_Q',
    'UCL6JmiMXKoXS6bpP1D3bk8g'
];

// Enhanced utility functions
function extractVideoIdFromUrl(url) {
    try {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    } catch (error) {
        console.error(`Error extracting video ID from ${url}:`, error.message);
        return null;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Advanced batch processing with backpressure control
class BatchProcessor {
    constructor(processFn, options = {}) {
        this.processFn = processFn;
        this.maxConcurrent = options.maxConcurrent || 5;
        this.batchDelay = options.batchDelay || 1000;
        this.retryDelay = options.retryDelay || 1000;
        this.maxRetries = options.maxRetries || 3;
        this.progressCallback = options.progressCallback;
        
        this.processed = 0;
        this.successful = 0;
        this.failed = 0;
        this.inProgress = new Set();
    }

    async processInBatches(items) {
        const results = [];
        const errors = [];
        
        for (let i = 0; i < items.length; i += this.maxConcurrent) {
            const batch = items.slice(i, i + this.maxConcurrent);
            const batchNumber = Math.floor(i / this.maxConcurrent) + 1;
            const totalBatches = Math.ceil(items.length / this.maxConcurrent);
            
            console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);
            
            const batchPromises = batch.map(async (item, index) => {
                const itemId = `${i + index}`;
                this.inProgress.add(itemId);
                
                try {
                    // Stagger requests within batch
                    await delay(index * PROCESSING_CONFIG.RATE_LIMITS.API_QUOTA_DELAY);
                    
                    const result = await this.processWithRetry(item);
                    this.processed++;
                    this.successful++;
                    
                    if (this.progressCallback) {
                        this.progressCallback({
                            processed: this.processed,
                            total: items.length,
                            successful: this.successful,
                            failed: this.failed,
                            item,
                            result
                        });
                    }
                    
                    return result;
                } catch (error) {
                    this.processed++;
                    this.failed++;
                    
                    const errorInfo = {
                        item,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    };
                    
                    errors.push(errorInfo);
                    console.error(`❌ Failed to process item: ${error.message}`);
                    return null;
                } finally {
                    this.inProgress.delete(itemId);
                }
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            batchResults.forEach((result) => {
                if (result.status === 'fulfilled' && result.value !== null) {
                    results.push(result.value);
                }
            });
            
            // Adaptive delay based on success rate
            if (i + this.maxConcurrent < items.length) {
                const successRate = this.successful / this.processed;
                const adaptiveDelay = successRate > 0.8 ? this.batchDelay : this.batchDelay * 1.5;
                
                console.log(`⏳ Waiting ${adaptiveDelay}ms (success rate: ${(successRate * 100).toFixed(1)}%)`);
                await delay(adaptiveDelay);
            }
        }
        
        return { results, errors };
    }

    async processWithRetry(item) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.processFn(item);
            } catch (error) {
                lastError = error;
                
                if (attempt < this.maxRetries) {
                    const retryDelay = Math.min(
                        this.retryDelay * Math.pow(PROCESSING_CONFIG.RATE_LIMITS.BACKOFF_MULTIPLIER, attempt - 1),
                        PROCESSING_CONFIG.RATE_LIMITS.MAX_BACKOFF
                    );
                    
                    console.log(`⚠️ Attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
                    await delay(retryDelay);
                }
            }
        }
        
        throw lastError;
    }
}

// Enhanced channel video fetching with caching
const channelVideoCache = new Map();

async function fetchChannelVideos(channelId, maxResults = 10) {
    try {
        // Check cache first (cache for 30 minutes)
        const cacheKey = `${channelId}_${maxResults}`;
        const cached = channelVideoCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
            console.log(`♻️ Using cached videos for channel: ${channelId}`);
            performanceMonitor.recordCacheHit();
            return cached.data;
        }
        
        console.log(`🔍 Fetching videos from channel: ${channelId}`);
        performanceMonitor.recordApiCall();
        
        const searchUrl = `https://www.googleapis.com/youtube/v3/search`;
        const params = {
            part: 'snippet',
            channelId: channelId,
            type: 'video',
            order: 'date',
            maxResults: maxResults,
            key: API_KEY
        };
        
        const response = await axios.get(searchUrl, {
            params,
            timeout: 10000,
            headers: {
                'User-Agent': 'SmartFetch/2.0'
            }
        });
        
        if (response.data.items && response.data.items.length > 0) {
            const result = {
                channelId,
                videoIds: response.data.items.map(item => item.id.videoId),
                channelTitle: response.data.items[0].snippet.channelTitle,
                totalResults: response.data.pageInfo?.totalResults || 0,
                success: true
            };
            
            // Cache the result
            channelVideoCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });
            
            console.log(`✅ Found ${result.videoIds.length} videos from ${result.channelTitle}`);
            return result;
        } else {
            console.log(`⚠️ No videos found for channel: ${channelId}`);
            return { channelId, videoIds: [], success: true };
        }
        
    } catch (error) {
        console.error(`❌ Error fetching videos from channel ${channelId}:`, error.message);
        
        if (error.response?.status === 403) {
            console.error('🔑 API quota exceeded or invalid API key');
        } else if (error.response?.status === 404) {
            console.error('🔍 Channel not found');
        }
        
        return { 
            channelId, 
            videoIds: [], 
            success: false, 
            error: error.message,
            statusCode: error.response?.status
        };
    }
}

// Enhanced video validation with batch checking
// Update the existing fetchChannelVideos function
async function fetchChannelVideos(channelId, maxResults = 10) {
  try {
    // Apply rate limiting
    await rateLimiter.wait();
    
    // Check cache first (existing logic)
    const cacheKey = `${channelId}_${maxResults}`;
    const cached = channelVideoCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
      console.log(`♻️ Using cached videos for channel: ${channelId}`);
      performanceMonitor.recordCacheHit();
      rateLimiter.recordSuccess(); // Record cache hit as success
      return cached.data;
    }

    console.log(`🔍 Fetching videos from channel: ${channelId}`);
    performanceMonitor.recordApiCall();
    
    const searchUrl = `https://www.googleapis.com/youtube/v3/search`;
    const params = {
      part: 'snippet',
      channelId: channelId,
      type: 'video',
      order: 'date',
      maxResults: maxResults,
      key: API_KEY
    };
    
    const response = await axios.get(searchUrl, {
      params,
      timeout: 10000,
      headers: {
        'User-Agent': 'SmartFetch/2.0'
      }
    });

    // Record successful API call
    rateLimiter.recordSuccess();

    if (response.data.items && response.data.items.length > 0) {
      const result = {
        channelId,
        videoIds: response.data.items.map(item => item.id.videoId),
        channelTitle: response.data.items[0].snippet.channelTitle,
        totalResults: response.data.pageInfo?.totalResults || 0,
        success: true
      };

      // Cache the result
      channelVideoCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      console.log(`✅ Found ${result.videoIds.length} videos from ${result.channelTitle}`);
      return result;
    } else {
      console.log(`⚠️ No videos found for channel: ${channelId}`);
      return { channelId, videoIds: [], success: true };
    }

  } catch (error) {
    // Record error with type for adaptive rate limiting
    let errorType = 'generic';
    if (error.response?.status === 429) {
      errorType = 'rate_limit';
    } else if (error.response?.status === 403) {
      errorType = 'quota_exceeded';
    } else if (error.response?.status === 400) {
      errorType = 'bad_request';
    }
    
    rateLimiter.recordError(errorType);
    
    console.error(`❌ Error fetching videos from channel ${channelId}:`, error.message);
    if (error.response?.status === 403) {
      console.error('🔑 API quota exceeded or invalid API key');
    } else if (error.response?.status === 404) {
      console.error('🔍 Channel not found');
    } else if (error.response?.status === 400) {
      console.error('📋 Invalid channel ID format');
    }

    return {
      channelId,
      videoIds: [],
      success: false,
      error: error.message,
      statusCode: error.response?.status
    };
  }
}


// Enhanced video processing with detailed extraction
async function processVideoDetailed(videoId, channelId = null) {
    const startTime = Date.now();
    
    try {
        console.log(`🎬 Processing video: ${videoId}`);
        
        // Fetch transcript with enhanced options
        const transcriptResult = await fetchTranscript(videoId, {
            useDescription: true,
            cleanDesc: true,
            maxRetries: 3,
            timeout: 15000,
            useCache: true,
            fallbackLanguages: ['en', 'en-US', 'auto']
        });
        
        if (transcriptResult.fromCache) {
            performanceMonitor.recordCacheHit();
        }
        
        if (!transcriptResult.success || transcriptResult.data.length === 0) {
            console.log(`⚠️ No content available for video: ${videoId}`);
            performanceMonitor.recordVideoProcessed(false, Date.now() - startTime);
            return { 
                videoId, 
                success: false, 
                reason: 'No content available',
                source: transcriptResult.source 
            };
        }
        
        // Get video metadata
        let videoMetadata = {};
        try {
            performanceMonitor.recordApiCall();
            
            const metadataUrl = `https://www.googleapis.com/youtube/v3/videos`;
            const params = {
                part: 'snippet,statistics',
                id: videoId,
                key: API_KEY
            };
            
            const metadataResponse = await axios.get(metadataUrl, { 
                params, 
                timeout: 8000 
            });
            
            if (metadataResponse.data.items && metadataResponse.data.items.length > 0) {
                const video = metadataResponse.data.items[0];
                videoMetadata = {
                    title: video.snippet.title,
                    channelTitle: video.snippet.channelTitle,
                    channelId: video.snippet.channelId,
                    publishedAt: video.snippet.publishedAt,
                    description: video.snippet.description,
                    viewCount: parseInt(video.statistics?.viewCount) || 0,
                    likeCount: parseInt(video.statistics?.likeCount) || 0,
                    commentCount: parseInt(video.statistics?.commentCount) || 0
                };
            }
        } catch (metadataError) {
            console.warn(`⚠️ Could not fetch metadata for ${videoId}: ${metadataError.message}`);
        }
        
        console.log(`📝 Processing content: ${transcriptResult.data.length} segments from ${transcriptResult.source}`);
        
        // Extract codes and links with the correct channel ID
        const extractionResult = await extractFromTranscript(
            transcriptResult.data, 
            channelId || videoMetadata.channelId
        );
        
        const hasContent = extractionResult.codes.length > 0 || 
                          extractionResult.links.length > 0 || 
                          extractionResult.percent_off.length > 0 || 
                          extractionResult.flat_discount.length > 0;
        
        if (hasContent) {
            const videoData = {
                videoId: videoId,
                videoTitle: videoMetadata.title || `Video ${videoId}`,
                channelTitle: videoMetadata.channelTitle || 'Unknown Channel',
                channelId: channelId || videoMetadata.channelId,
                publishedAt: videoMetadata.publishedAt || new Date().toISOString(),
                timestamp: new Date().toISOString(),
                contentSource: transcriptResult.source,
                viewCount: videoMetadata.viewCount || 0,
                ...extractionResult
            };
            
            console.log(`💾 Found content for ${videoId}: ${extractionResult.codes.length} codes, ${extractionResult.links.length} links, ${extractionResult.percent_off.length} percent off, ${extractionResult.flat_discount.length} flat discounts`);
            
            performanceMonitor.recordVideoProcessed(true, Date.now() - startTime);
            return { 
                videoId, 
                success: true, 
                data: videoData,
                hasContent: true 
            };
        } else {
            console.log(`⚠️ No codes or links found in video: ${videoId}`);
            performanceMonitor.recordVideoProcessed(false, Date.now() - startTime);
            return { 
                videoId, 
                success: true, 
                reason: 'No content found',
                hasContent: false 
            };
        }
        
    } catch (error) {
        console.error(`❌ Error processing video ${videoId}:`, error.message);
        performanceMonitor.recordVideoProcessed(false, Date.now() - startTime);
        return { 
            videoId, 
            success: false, 
            reason: 'Processing error', 
            error: error.message 
        };
    }
}

// Enhanced batch sheet synchronization
async function batchSyncToSheet(videoDataArray) {
    if (!videoDataArray || videoDataArray.length === 0) {
        return { success: true, processed: 0 };
    }
    
    console.log(`📊 Syncing ${videoDataArray.length} videos to Google Sheets...`);
    
    const results = [];
    const errors = [];
    
    // Process in smaller batches to avoid API limits
    for (let i = 0; i < videoDataArray.length; i += PROCESSING_CONFIG.SHEET_BATCH_SIZE) {
        const batch = videoDataArray.slice(i, i + PROCESSING_CONFIG.SHEET_BATCH_SIZE);
        
        try {
            const batchPromises = batch.map(async (videoData) => {
                try {
                    await syncToSheet(videoData);
                    return { success: true, videoId: videoData.videoId };
                } catch (error) {
                    console.error(`❌ Failed to sync ${videoData.videoId}: ${error.message}`);
                    return { success: false, videoId: videoData.videoId, error: error.message };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Small delay between sheet batches
            if (i + PROCESSING_CONFIG.SHEET_BATCH_SIZE < videoDataArray.length) {
                await delay(1000);
            }
            
        } catch (error) {
            console.error(`❌ Batch sheet sync error: ${error.message}`);
            errors.push({ batch: i, error: error.message });
        }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`✅ Sheet sync complete: ${successful}/${videoDataArray.length} successful`);
    
    return {
        success: successful > 0,
        processed: successful,
        failed: results.length - successful,
        errors
    };
}

// Main execution function with advanced parallel processing
async function runAll() {
    try {
        console.log('🚀 Starting SmartFetch with Advanced Parallel Processing...');
        console.log(`⚙️ Configuration:`);
        console.log(`   - Max concurrent channels: ${PROCESSING_CONFIG.MAX_CONCURRENT_CHANNELS}`);
        console.log(`   - Max concurrent videos: ${PROCESSING_CONFIG.MAX_CONCURRENT_VIDEOS}`);
        console.log(`   - Max concurrent transcripts: ${PROCESSING_CONFIG.MAX_CONCURRENT_TRANSCRIPTS}`);
        console.log(`   - Video batch size: ${PROCESSING_CONFIG.VIDEO_BATCH_SIZE}`);
        
        const startTime = Date.now();
        const videoIds = new Set();
        const videoChannelMap = new Map();
        const videosWithContent = [];
        
        // Process individual video links
        console.log(`\n🔗 Processing ${VIDEO_LINKS.length} individual video links...`);
        for (const url of VIDEO_LINKS) {
            const videoId = extractVideoIdFromUrl(url);
            if (videoId) {
                videoIds.add(videoId);
            } else {
                console.warn(`⚠️ Could not extract video ID from URL: ${url}`);
            }
        }

        // Before you process channels, sanitize and validate
const sanitizedChannelIds = CHANNEL_IDS.map(sanitizeChannelId);
const validChannelIds = sanitizedChannelIds.filter(isStrictlyValidChannelId);

if (validChannelIds.length === 0) {
  console.error('❌ No valid channel IDs to process. Please check your CHANNEL_IDS list.');
  return;
}

        
        // STEP 1: Parallel channel processing
        if (CHANNEL_IDS.length > 0) {
            console.log(`\n🎯 Processing ${CHANNEL_IDS.length} channels...`);
            
            const channelProcessor = new BatchProcessor(
                (channelId) => fetchChannelVideos(channelId, 8),
                {
                    maxConcurrent: PROCESSING_CONFIG.MAX_CONCURRENT_CHANNELS,
                    batchDelay: PROCESSING_CONFIG.RATE_LIMITS.BETWEEN_CHANNELS,
                    maxRetries: 2,
                    progressCallback: (progress) => {
                        if (progress.processed % 5 === 0 || progress.processed === progress.total) {
                            console.log(`📊 Channel progress: ${progress.processed}/${progress.total} (${progress.successful} successful)`);
                        }
                    }
                }
            );
            
            const { results: channelResults, errors: channelErrors } = await channelProcessor.processInBatches(validChannelIds);
            
            // Create video-to-channel mapping and collect video IDs
            let totalChannelVideos = 0;
            channelResults.forEach(result => {
                if (result && result.success) {
                    result.videoIds.forEach(videoId => {
                        videoIds.add(videoId);
                        videoChannelMap.set(videoId, result.channelId);
                    });
                    totalChannelVideos += result.videoIds.length;
                }
            });
            
            console.log(`\n📊 Channel processing summary:`);
            console.log(`   - Successful channels: ${channelResults.length}/${CHANNEL_IDS.length}`);
            console.log(`   - Total videos from channels: ${totalChannelVideos}`);
            console.log(`   - Channel errors: ${channelErrors.length}`);
        }
        
        console.log(`\n📝 Total unique videos to process: ${videoIds.size}`);
        
        // STEP 2: Video validation (optional, for large datasets)
        let validVideoIds = Array.from(videoIds);
        if (videoIds.size > 100) {
            console.log(`\n🔍 Validating ${videoIds.size} videos...`);
            const { validVideos, invalidVideos } = await validateVideosExist(Array.from(videoIds));
            validVideoIds = validVideos;
            
            if (invalidVideos.length > 0) {
                console.log(`⚠️ Filtered out ${invalidVideos.length} invalid videos`);
            }
        }
        
        // STEP 3: Parallel video processing with content extraction
        console.log(`\n🎬 Processing ${validVideoIds.length} videos for content extraction...`);
        
        const videoProcessor = new BatchProcessor(
            (videoId) => processVideoDetailed(videoId, videoChannelMap.get(videoId)),
            {
                maxConcurrent: PROCESSING_CONFIG.MAX_CONCURRENT_VIDEOS,
                batchDelay: PROCESSING_CONFIG.RATE_LIMITS.BETWEEN_VIDEOS,
                maxRetries: 2,
                progressCallback: (progress) => {
                    if (progress.processed % 10 === 0 || progress.processed === progress.total) {
                        console.log(`📊 Video progress: ${progress.processed}/${progress.total} (${progress.successful} successful)`);
                        
                        // Print performance stats every 50 videos
                        if (progress.processed % 50 === 0) {
                            performanceMonitor.printStats();
                        }
                    }
                }
            }
        );
        
        const { results: videoResults, errors: videoErrors } = await videoProcessor.processInBatches(validVideoIds);
        
        // Collect videos with content for sheet sync
        videoResults.forEach(result => {
            if (result && result.success && result.hasContent && result.data) {
                videosWithContent.push(result.data);
            }
        });
        
        // STEP 4: Batch synchronization to Google Sheets
        if (videosWithContent.length > 0) {
            console.log(`\n📊 Synchronizing ${videosWithContent.length} videos with content to Google Sheets...`);
            
            const sheetSyncResult = await batchSyncToSheet(videosWithContent);
            console.log(`✅ Sheet synchronization: ${sheetSyncResult.processed} videos synced`);
        } else {
            console.log(`\n⚠️ No videos with extractable content found`);
        }
        
        // FINAL SUMMARY
        const endTime = Date.now();
        const totalDuration = (endTime - startTime) / 1000;
        
        const successful = videoResults.filter(r => r && r.success).length;
        const withContent = videoResults.filter(r => r && r.success && r.hasContent).length;
        const failed = videoResults.filter(r => !r || !r.success).length;
        
        console.log(`\n🎉 SmartFetch completed successfully!`);
        console.log(`⏱️  Total execution time: ${totalDuration.toFixed(2)} seconds`);
        console.log(`\n📊 Final Summary:`);
        console.log(`   - Total videos processed: ${validVideoIds.length}`);
        console.log(`   - Successfully processed: ${successful}`);
        console.log(`   - Videos with content: ${withContent}`);
        console.log(`   - Failed processing: ${failed}`);
        console.log(`   - Processing speed: ${(validVideoIds.length / totalDuration).toFixed(2)} videos/second`);
        console.log(`   - Content extraction rate: ${((withContent / successful) * 100).toFixed(1)}%`);
        
        // Print detailed performance statistics
        performanceMonitor.printStats();
        
        // Failure analysis
        if (failed > 0) {
            console.log(`\n🔍 Failure Analysis:`);
            const failureReasons = {};
            videoResults.filter(r => !r || !r.success).forEach(r => {
                const reason = r?.reason || 'Unknown error';
                failureReasons[reason] = (failureReasons[reason] || 0) + 1;
            });
            
            Object.entries(failureReasons).forEach(([reason, count]) => {
                console.log(`   - ${reason}: ${count} videos`);
            });
             // Add rate limiter stats
  const rateLimiterStats = rateLimiter.getStats();
  console.log(`\n📊 Rate Limiter Stats:`);
  console.log(` - Current delay: ${rateLimiterStats.currentDelay}ms`);
  console.log(` - Successful calls: ${rateLimiterStats.successCount}`);
  console.log(` - Failed calls: ${rateLimiterStats.errorCount}`);
  console.log(` - Consecutive errors: ${rateLimiterStats.consecutiveErrors}`);
  
  // Add memory stats
  const memStats = memoryManager.getMemoryStats();
  console.log(`\n💾 Final Memory Usage:`);
  console.log(` - Heap Used: ${memStats.heapUsed}MB`);
  console.log(` - Heap Total: ${memStats.heapTotal}MB`);
  console.log(` - RSS: ${memStats.rss}MB`);
        }
        
        return {
            totalProcessed: validVideoIds.length,
            successful,
            withContent,
            failed,
            duration: totalDuration,
            videosWithContent
        };
        
    } catch (error) {
        console.error('❌ Critical error in runAll:', error);
        throw error;
    }
}

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('\n⚠️ Received SIGINT, shutting down gracefully...');
    performanceMonitor.printStats();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n⚠️ Received SIGTERM, shutting down gracefully...');
    performanceMonitor.printStats();
    process.exit(0);
});

// Export for testing and external use
module.exports = {
    runAll,
    fetchChannelVideos,
    processVideoDetailed,
    BatchProcessor,
    PerformanceMonitor,
    PROCESSING_CONFIG,
    validateVideosExist,
    batchSyncToSheet
};

// Run immediately if called directly
if (require.main === module) {
    runAll().catch(error => {
        console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}