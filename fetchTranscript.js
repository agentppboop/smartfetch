// fetchTranscript.js - UPDATED VERSION using YouTube API

const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.YOUTUBE_API_KEY;

async function fetchTranscript(videoId) {
    if (!videoId) {
        console.error('❌ Video ID is required');
        return [];
    }

    try {
        console.log(`🎯 Fetching captions for video: ${videoId}`);
        
        // Step 1: Get available caption tracks
        const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${API_KEY}`;
        const captionsResponse = await axios.get(captionsUrl);
        
        if (!captionsResponse.data.items || captionsResponse.data.items.length === 0) {
            console.log('⚠️ No captions available for this video');
            return [];
        }

        console.log(`✅ Found ${captionsResponse.data.items.length} caption track(s)`);
        
        // For now, return mock transcript data since downloading actual captions requires additional OAuth
        // In a production environment, you'd need to implement OAuth2 flow to download caption content
        const mockTranscript = [
            "Welcome to this video about amazing deals and discounts",
            "Use promo code SAVE20 to get 20% off your first order",
            "Don't forget to check out our special offer with code NEWUSER",
            "Visit our website at https://example.com for more deals",
            "Get ₹500 cashback with code CASHBACK500",
            "This offer is valid for limited time only"
        ];
        
        console.log(`✅ Mock transcript generated: ${mockTranscript.length} lines`);
        return mockTranscript;
        
    } catch (error) {
        if (error.response?.status === 403) {
            console.log('⚠️ Caption access forbidden - video may have restricted captions');
        } else if (error.response?.status === 404) {
            console.log('⚠️ Video not found or captions not available');
        } else {
            console.error(`❌ Error fetching captions: ${error.message}`);
        }
        return [];
    }
}

module.exports = fetchTranscript;
