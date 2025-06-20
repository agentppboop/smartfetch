// index.js - COMPLETE CORRECTED VERSION

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
    'https://www.youtube.com/watch?v=z51M9cit-X0',
    'https://www.youtube.com/watch?v=example123',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
];

const PLAYLIST_IDS = [
    'PLexampleplaylist123'
];

const CHANNEL_IDS = [
    'UCexamplechannel123'
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
} // ← ADD THIS MISSING CLOSING BRACE

async function fetchVideoDetails(videoId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
        const response = await axios.get(url);
        
        if (response.data.items && response.data.items.length > 0) {
            const video = response.data.items[0];
            console.log(`📹 Video: ${video.snippet.title}`);
            
            // Fetch transcript
            const transcript = await fetchTranscript(videoId);
            
            if (transcript.length > 0) {
                // Extract codes from transcript
                const extractionResult = await extractFromTranscript(transcript);
                
                if (extractionResult.codes.length > 0 || extractionResult.links.length > 0) {
                    const videoData = {
                        videoId: videoId,
                        videoTitle: video.snippet.title,
                        timestamp: new Date().toISOString(),
                        ...extractionResult
                    };
                    
                    // Sync to Google Sheets
                    await syncToSheet(videoData);
                }
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
        
        // Process video links
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
        
        // Process each video
        for (const id of videoIds) {
            console.log(`\n🎯 Checking video ID: ${id}`);
            await fetchVideoDetails(id);
        }
        
        console.log('\n✅ SmartFetch completed successfully');
        
    } catch (error) {
        console.error('❌ Error in runAll:', error.message);
    }
}

// Run immediately
runAll();

// Schedule periodic runs (uncomment when ready)
// const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
// setInterval(runAll, INTERVAL_MS);
