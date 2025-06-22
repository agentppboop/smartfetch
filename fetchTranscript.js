// fetchTranscript.js - ENHANCED PRODUCTION VERSION

const { YoutubeTranscript } = require('youtube-transcript');
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.YOUTUBE_API_KEY;

// Enhanced description cleaning with more patterns
function cleanDescription(desc) {
  if (!desc || typeof desc !== 'string') return '';
  
  return desc
    // Remove common section headers
    .replace(/\b(?:CHAPTERS|TIMESTAMPS|SPONSORS|AFFILIATE|LINKS|SOCIAL|CONTACT)\s*:?.*/gmi, '')
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Remove email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
    // Remove long alphanumeric sequences (likely IDs/codes)
    .replace(/\b[A-Z0-9]{8,}\b/g, '')
    // Remove excessive whitespace and empty lines
    .replace(/\n\s*\n/g, '\n')
    .replace(/^\s+|\s+$/gm, '')
    // Remove social media handles
    .replace(/@\w+/g, '')
    // Remove hashtags at end of lines
    .replace(/#\w+(\s+#\w+)*/g, '')
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
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Rate limiting helper
const rateLimiter = {
  lastCall: 0,
  minInterval: 1000, // 1 second between API calls
  
  async wait() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    if (timeSinceLastCall < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastCall));
    }
    this.lastCall = Date.now();
  }
};

async function fetchTranscript(videoInput, options = {}) {
    const {
      useDescription = true,
      cleanDesc = true,
      maxRetries = 2,
      timeout = 10000
    } = options;

    const videoId = extractVideoId(videoInput);
    
    if (!videoId) {
        console.error('❌ Invalid video ID or URL provided');
        return { success: false, data: [], source: null, error: 'Invalid video ID' };
    }

    console.log(`🎯 Fetching transcript for video: ${videoId}`);
    
    let lastError = null;
    
    // Try transcript first (primary method)
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Attempt ${attempt}/${maxRetries} - Fetching transcript...`);
            
            const transcriptPromise = YoutubeTranscript.fetchTranscript(videoId);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Transcript fetch timeout')), timeout)
            );
            
            const transcript = await Promise.race([transcriptPromise, timeoutPromise]);
            
            if (transcript && transcript.length > 0) {
                const transcriptText = transcript.map(item => ({
                    text: item.text?.trim() || '',
                    start: item.start || 0,
                    duration: item.duration || 0
                })).filter(item => item.text.length > 0);
                
                console.log(`✅ Transcript fetched: ${transcriptText.length} segments`);
                return {
                    success: true,
                    data: transcriptText,
                    source: 'transcript',
                    videoId: videoId,
                    totalSegments: transcriptText.length
                };
            }
        } catch (transcriptError) {
            lastError = transcriptError;
            console.log(`⚠️ Transcript attempt ${attempt} failed: ${transcriptError.message}`);
            
            if (attempt < maxRetries) {
                console.log('⏳ Waiting before retry...');
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }

    // Fallback to video description if enabled
    if (useDescription && API_KEY) {
        try {
            console.log('📝 Trying video description fallback...');
            
            await rateLimiter.wait();
            
            const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
            const videoResponse = await axios.get(videoUrl, { timeout });
            
            if (videoResponse.data.items && videoResponse.data.items.length > 0) {
                let description = videoResponse.data.items[0].snippet.description || '';
                const title = videoResponse.data.items[0].snippet.title || '';
                
                if (cleanDesc) {
                    description = cleanDescription(description);
                }
                
                if (description.length > 50) { // Minimum meaningful length
                    const descriptionLines = description
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0 && line.length < 500); // Filter very long lines
                    
                    console.log(`✅ Using video description: ${descriptionLines.length} lines`);
                    return {
                        success: true,
                        data: descriptionLines,
                        source: 'description',
                        videoId: videoId,
                        title: title,
                        totalLines: descriptionLines.length
                    };
                }
            }
        } catch (descError) {
            console.error(`❌ Description fallback failed: ${descError.message}`);
            lastError = descError;
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
        error: lastError?.message || 'No content available'
    };
}

// Batch processing function
async function fetchMultipleTranscripts(videoInputs, options = {}) {
    const results = [];
    const { batchDelay = 2000 } = options;
    
    console.log(`📦 Processing ${videoInputs.length} videos...`);
    
    for (let i = 0; i < videoInputs.length; i++) {
        console.log(`\n🔄 Processing ${i + 1}/${videoInputs.length}`);
        
        const result = await fetchTranscript(videoInputs[i], options);
        results.push(result);
        
        // Add delay between requests to be respectful
        if (i < videoInputs.length - 1) {
            console.log(`⏳ Waiting ${batchDelay}ms before next request...`);
            await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`\n✅ Batch complete: ${successful}/${videoInputs.length} successful`);
    
    return results;
}

module.exports = {
    fetchTranscript,
    fetchMultipleTranscripts,
    extractVideoId,
    cleanDescription
};