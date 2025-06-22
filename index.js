// index.js - COMPLETE CORRECTED VERSION WITH CHANNEL PROCESSING

// Validate environment first
const envVars = require('./validateEnv');

const axios = require('axios');
const fetchTranscript = require('./fetchTranscript');
const { extractFromTranscript } = require('./textExtract');
const syncToSheet = require('./syncToSheet');
const config = require('./config');

const API_KEY = process.env.YOUTUBE_API_KEY;

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

// NEW FUNCTION: Fetch recent videos from a channel
async function fetchChannelVideos(channelId, maxResults = 10) {
    try {
        console.log(`🔍 Fetching videos from channel: ${channelId}`);
        
        // Get recent videos from channel
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
            return;
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
                
                // Extract codes from transcript
                console.log(`🔍 Starting code extraction...`);
                const extractionResult = await extractFromTranscript(transcript);
                
                console.log(`📊 Extraction result:`, extractionResult);
                
                if (extractionResult.codes.length > 0 || extractionResult.links.length > 0) {
                    const videoData = {
                        videoId: videoId,
                        videoTitle: video.snippet.title,
                        channelTitle: video.snippet.channelTitle,
                        publishedAt: video.snippet.publishedAt,
                        timestamp: new Date().toISOString(),
                        ...extractionResult
                    };
                    
                    console.log(`💾 Saving data for video: ${videoId}`);
                    console.log(`   - Codes found: ${extractionResult.codes.length}`);
                    console.log(`   - Links found: ${extractionResult.links.length}`);
                    console.log(`   - Confidence: ${extractionResult.confidence}`);
                    
                    // Sync to Google Sheets
                    try {
                        await syncToSheet(videoData);
                    } catch (sheetError) {
                        console.error(`❌ Failed to sync to Google Sheets: ${sheetError.message}`);
                    }
                } else {
                    console.log(`⚠️ No codes or links found in video: ${videoId}`);
                }
            } else {
                console.log(`⚠️ No transcript available for video: ${videoId}`);
            }
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
    } catch (err) {
        console.error(`❌ Error processing video ${videoId}:`, err.message);
    }
}

async function runAll() {
    try {
        console.log('🚀 Starting SmartFetch...');
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
        
        // NEW: Process channels to get recent videos
        console.log(`🎯 Processing ${CHANNEL_IDS.length} channels...`);
        
        for (const channelId of CHANNEL_IDS) {
            try {
                console.log(`\n📺 Processing channel: ${channelId}`);
                const channelVideoIds = await fetchChannelVideos(channelId, 5); // Get 5 recent videos per channel
                
                // Add channel videos to our set
                channelVideoIds.forEach(id => videoIds.add(id));
                
                // Rate limiting between channels
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.error(`❌ Error processing channel ${channelId}:`, error.message);
            }
        }
        
        console.log(`\n📝 Processing ${videoIds.size} total videos...`);
        
        // Process each video
        let processedCount = 0;
        for (const id of videoIds) {
            processedCount++;
            console.log(`\n🎯 [${processedCount}/${videoIds.size}] Processing video: ${id}`);
            await fetchVideoDetails(id);
        }
        
        console.log('\n✅ SmartFetch completed successfully');
        console.log(`📊 Total videos processed: ${videoIds.size}`);
        
    } catch (error) {
        console.error('❌ Error in runAll:', error.message);
    }
}

// Run immediately
runAll();
