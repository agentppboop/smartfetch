// Load environment variables from .env file
require('dotenv').config();

// Import axios for API requests
const axios = require('axios');

// Your YouTube API key from .env
const API_KEY = process.env.YOUTUBE_API_KEY;

// Replace this with any real YouTube video ID
const VIDEO_ID = 'XvBGkq0U3GU'; // Example: Rick Astley :)

// Function to fetch video data
async function fetchVideoDetails(videoId) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
    
    const response = await axios.get(url);
    const video = response.data.items[0];

    if (!video) {
      console.log("Video not found or invalid ID.");
      return;
    }

    const { title, description } = video.snippet;

    console.log(`🎬 Title: ${title}`);
    console.log(`📝 Description:\n${description}`);

     const foundCodes = extractCodes(description);

    if (foundCodes.length === 0) {
      console.log("❌ No codes found.");
    } else {
      console.log("✅ Found codes:");
      foundCodes.forEach(code => console.log(`🔗 ${code}`));
    }
  } catch (err) {
    console.error("❌ Error fetching video data:", err.message);
  }
}

function extractCodes(text) {
  const codePatterns = [
    /https?:\/\/[^\s]+/g,                  // Links (bit.ly, etc.)
    /\b[A-Z0-9]{5,}\b/g,                   // Long codes like PROMO123
    /use code[:\- ]?([A-Z0-9]+)/gi,        // "Use code: XYZ10"
    /coupon[:\- ]?([A-Z0-9]+)/gi,
    /ref[:\- ]?([A-Z0-9]+)/gi,
    /promo[:\- =]?([A-Z0-9]+)/gi
  ];

  const matches = new Set();

  for (const pattern of codePatterns) {
    const found = text.match(pattern);
    if (found) {
      found.forEach(code => matches.add(code.trim()));
    }
  }

  return [...matches];
}


// Run the function
fetchVideoDetails(VIDEO_ID);
