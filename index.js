// index.js - PARALLEL PROCESSING VERSION

// Validate environment first
const envVars = require('./validateEnv');

const axios = require('axios');
const fetchTranscript = require('./fetchTranscript');
const { extractFromTranscript } = require('./textExtract');
const syncToSheet = require('./syncToSheet');
const config = require('./config');

const API_KEY = process.env.YOUTUBE_API_KEY;

// PARALLEL PROCESSING CONFIGURATION
const PARALLEL_CONFIG = {
    // Maximum concurrent video processes
    MAX_CONCURRENT_VIDEOS: 5,
    
    // Maximum concurrent channel processes
    MAX_CONCURRENT_CHANNELS: 3,
    
    // Delay between batches (milliseconds)
    BATCH_DELAY: 2000,
    
    // Rate limiting delays
    RATE_LIMITS: {
        BETWEEN_VIDEOS: 500,    // ms between individual video requests
        BETWEEN_CHANNELS: 1000, // ms between channel requests
        API_QUOTA_DELAY: 100    // ms between API calls to avoid quota issues
    }
};

// Configuration
const VIDEO_LINKS = [
    // Individual video URLs (optional)
];

const CHANNEL_IDS = [
    'UCIPPMRA040LQr5QPyJEbmXA', // MrBeast Gaming
    'UCX6OQ3DkcsbYNE6H8uQQuVA', // MrBeast main channel
    // Gaming channels
    'UCjmJDM5pRKbUlVIzDYYWb6g',
    'UC7_YxT-KID8kRbqZo7MyscQ',
    'UCke6I9N4KfC968-yRcd5YRg',
    'UCq-Fj5jknLsUf-MWSy4_brA',
    // Tech review channels
    'UCMiJRAwDNSNzuYeN2uWa0pA',
    'UCzlXf-yUIaOpOjEjPrOO9TA',
    'UCOmcA3f_RrH6b9NmcNa4tdg',
    'UC6107grRI4m0o2-emgoDnAA',
    'UCXuqSBlHAE6Xw-yeJA0Tunw',
    // Deal/coupon channels
    'UC5Qbo0AR3CwpmEq751BIy0g',
    'UCnzjNQQOosDeUBa2MUmTV3g',
    'UC8Q7XEy86Q7T-3kNpNjYgwA',
    'UCBJycsmduvYEL83R_U4JriQ',
    // Affiliate marketing channels
    'UC7RZRFCrN4XKoMsy5MgJKrg',
    'UCuVoO3TArgovwAeWhY1TVSA',
    'UCMQapqmTjEIBNK6_a5H_4Qg',
    'UC2aQkrg2-Nh5rIITzNe8D_Q',
    'UCL6JmiMXKoXS6bpP1D3bk8g'
];

// Utility functions
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// PARALLEL PROCESSING HELPER: Process items in batches with concurrency limit
async function processInBatches(items, processFn, maxConcurrent = 5, batchDelay = 1000) {
    const results = [];
    
    for (let i = 0; i < items.length; i += maxConcurrent) {
        const batch = items.slice(i, i + maxConcurrent);
        console.log(`📦 Processing batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(items.length / maxConcurrent)} (${batch.length} items)`);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (item, index) => {
            try {
                // Small delay to stagger requests within batch
                await delay(index * PARALLEL_CONFIG.RATE_LIMITS.API_QUOTA_DELAY);
                return await processFn(item);
            } catch (error) {
                console.error(`❌ Error processing item ${item}:`, error.message);
                return null;
            }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Extract successful results
        batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value !== null) {
                results.push(result.value);
            } else if (result.status === 'rejected') {
                console.error(`❌ Batch item ${batch[index]} failed:`, result.reason);
            }
        });
        
        // Delay between batches to respect rate limits
        if (i + maxConcurrent < items.length) {
            console.log(`⏳ Waiting ${batchDelay}ms before next batch...`);
            await delay(batchDelay);
        }
    }
    
    return results.filter(result => result !== null);
}

// PARALLEL CHANNEL PROCESSING
async function fetchChannelVideos(channelId, maxResults = 10) {
    try {
        console.log(`🔍 Fetching videos from channel: ${channelId}`);
        
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=${maxResults}&key=${API_KEY}`;
        
        const response = await axios.get(searchUrl);
        
        if (response.data.items && response.data.items.length > 0) {
            console.log(`✅ Found ${response.data.items.length} videos from channel ${channelId}`);
            return {
                channelId,
                videoIds: response.data.items.map(item => item.id.videoId),
                success: true
            };
        } else {
            console.log(`⚠️ No videos found for channel: ${channelId}`);
            return { channelId, videoIds: [], success: true };
        }
        
    } catch (error) {
        console.error(`❌ Error fetching videos from channel ${channelId}:`, error.message);
        if (error.response) {
            console.error(`API Response:`, error.response.data);
        }
        return { channelId, videoIds: [], success: false, error: error.message };
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

// PARALLEL VIDEO PROCESSING
async function fetchVideoDetails(videoId) {
    try {
        // Validate video exists first
        const exists = await validateVideoExists(videoId);
        if (!exists) {
            console.log(`⚠️ Video ${videoId} does not exist or is not accessible`);
            return { videoId, success: false, reason: 'Video not found' };
        }

        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
        const response = await axios.get(url);
        
        if (response.data.items && response.data.items.length > 0) {
            const video = response.data.items[0];
            console.log(`📹 Processing: ${video.snippet.title}`);
            
            // Fetch transcript
            const transcript = await fetchTranscript(videoId);
            
            if (transcript.length > 0) {
                console.log(`✅ Transcript found: ${transcript.length} lines`);
                
                // Extract codes from transcript
                const extractionResult = await extractFromTranscript(transcript);
                
                if (extractionResult.codes.length > 0 || extractionResult.links.length > 0) {
                    const videoData = {
                        videoId: videoId,
                        videoTitle: video.snippet.title,
                        channelTitle: video.snippet.channelTitle,
                        publishedAt: video.snippet.publishedAt,
                        timestamp: new Date().toISOString(),
                        ...extractionResult
                    };
                    
                    console.log(`💾 Found content for ${videoId}: ${extractionResult.codes.length} codes, ${extractionResult.links.length} links`);
                    
                    // Sync to Google Sheets
                    try {
                        await syncToSheet(videoData);
                        return { videoId, success: true, data: videoData };
                    } catch (sheetError) {
                        console.error(`❌ Failed to sync to Google Sheets: ${sheetError.message}`);
                        return { videoId, success: false, reason: 'Sheet sync failed', error: sheetError.message };
                    }
                } else {
                    console.log(`⚠️ No codes or links found in video: ${videoId}`);
                    return { videoId, success: true, reason: 'No content found' };
                }
            } else {
                console.log(`⚠️ No transcript available for video: ${videoId}`);
                return { videoId, success: false, reason: 'No transcript' };
            }
        }
        
    } catch (err) {
        console.error(`❌ Error processing video ${videoId}:`, err.message);
        return { videoId, success: false, reason: 'Processing error', error: err.message };
    }
}

// MAIN PARALLEL EXECUTION FUNCTION
async function runAll() {
    try {
        console.log('🚀 Starting SmartFetch with parallel processing...');
        console.log(`⚙️ Config: ${PARALLEL_CONFIG.MAX_CONCURRENT_CHANNELS} concurrent channels, ${PARALLEL_CONFIG.MAX_CONCURRENT_VIDEOS} concurrent videos`);
        
        const startTime = Date.now();
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
        
        // PARALLEL CHANNEL PROCESSING
        console.log(`\n🎯 Processing ${CHANNEL_IDS.length} channels in parallel...`);
        
        const channelResults = await processInBatches(
            CHANNEL_IDS,
            (channelId) => fetchChannelVideos(channelId, 5),
            PARALLEL_CONFIG.MAX_CONCURRENT_CHANNELS,
            PARALLEL_CONFIG.RATE_LIMITS.BETWEEN_CHANNELS
        );
        
        // Collect all video IDs from channels
        let totalChannelVideos = 0;
        channelResults.forEach(result => {
            if (result && result.success) {
                result.videoIds.forEach(id => videoIds.add(id));
                totalChannelVideos += result.videoIds.length;
            }
        });
        
        console.log(`\n📊 Channel processing complete:`);
        console.log(`   - Successful channels: ${channelResults.filter(r => r && r.success).length}/${CHANNEL_IDS.length}`);
        console.log(`   - Total videos from channels: ${totalChannelVideos}`);
        console.log(`   - Unique videos to process: ${videoIds.size}`);
        
        // PARALLEL VIDEO PROCESSING
        console.log(`\n🎬 Processing ${videoIds.size} videos in parallel...`);
        
        const videoResults = await processInBatches(
            Array.from(videoIds),
            fetchVideoDetails,
            PARALLEL_CONFIG.MAX_CONCURRENT_VIDEOS,
            PARALLEL_CONFIG.RATE_LIMITS.BETWEEN_VIDEOS
        );
        
        // Summary statistics
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        const successful = videoResults.filter(r => r && r.success && r.data).length;
        const withContent = videoResults.filter(r => r && r.success && r.data && 
            (r.data.codes.length > 0 || r.data.links.length > 0)).length;
        const failed = videoResults.filter(r => !r || !r.success).length;
        
        console.log(`\n✅ SmartFetch completed in ${duration.toFixed(2)} seconds`);
        console.log(`📊 Processing Summary:`);
        console.log(`   - Total videos processed: ${videoIds.size}`);
        console.log(`   - Successful: ${successful}`);
        console.log(`   - With content found: ${withContent}`);
        console.log(`   - Failed: ${failed}`);
        console.log(`   - Average time per video: ${(duration / videoIds.size).toFixed(2)}s`);
        
        // Detailed failure analysis
        if (failed > 0) {
            console.log(`\n🔍 Failure breakdown:`);
            const failureReasons = {};
            videoResults.filter(r => !r || !r.success).forEach(r => {
                const reason = r?.reason || 'Unknown error';
                failureReasons[reason] = (failureReasons[reason] || 0) + 1;
            });
            
            Object.entries(failureReasons).forEach(([reason, count]) => {
                console.log(`   - ${reason}: ${count}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error in runAll:', error.message);
    }
}

// Export for testing
module.exports = {
    runAll,
    fetchChannelVideos,
    fetchVideoDetails,
    processInBatches,
    PARALLEL_CONFIG
};

// Run immediately
if (require.main === module) {
    runAll();
}