// fetchTranscript.js - PRODUCTION VERSION

const { YoutubeTranscript } = require('youtube-transcript');
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.YOUTUBE_API_KEY;

async function fetchTranscript(videoId) {
    if (!videoId) {
        console.error('❌ Video ID is required');
        return [];
    }

    try {
        console.log(`🎯 Fetching transcript for video: ${videoId}`);
        
        // Try youtube-transcript first (free method)
        try {
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            if (transcript && transcript.length > 0) {
                const transcriptLines = transcript.map(item => item.text);
                console.log(`✅ Transcript fetched: ${transcriptLines.length} lines`);
                return transcriptLines;
            }
        } catch (transcriptError) {
            console.log('⚠️ youtube-transcript failed, trying video description...');
        }

        // Fallback to video description
        const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
        const videoResponse = await axios.get(videoUrl);
        
        if (videoResponse.data.items && videoResponse.data.items.length > 0) {
            const description = videoResponse.data.items[0].snippet.description || '';
            
            if (description.length > 0) {
                console.log(`✅ Using video description: ${description.length} characters`);
                const descriptionLines = description.split('\n').filter(line => line.trim().length > 0);
                return descriptionLines;
            }
        }

        console.log('⚠️ No transcript or description available');
        return [];
        
    } catch (error) {
        console.error(`❌ Error fetching transcript: ${error.message}`);
        return [];
    }
}

module.exports = fetchTranscript;
