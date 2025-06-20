// fetchTranscript.js - COMPLETE CORRECTED VERSION

const { YoutubeTranscript } = require('youtube-transcript');

async function fetchTranscript(videoId) {
    if (!videoId) {
        console.error('❌ Video ID is required');
        return [];
    }

    try {
        console.log(`🎯 Fetching transcript for video: ${videoId}`);
        const transcript = await YoutubeTranscript.fetchTranscript(videoId);
        
        if (!transcript || transcript.length === 0) {
            console.log('⚠️ No transcript available for this video');
            return [];
        }

        // Extract text from transcript objects
        const transcriptLines = transcript.map(item => item.text);
        console.log(`✅ Transcript fetched: ${transcriptLines.length} lines`);
        
        return transcriptLines;
        
    } catch (error) {
        console.error(`❌ Error fetching transcript for video ${videoId}:`, error.message);
        return [];
    }
}

module.exports = fetchTranscript;
