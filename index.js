// 📦 Load environment variables
require('dotenv').config();

// 🔗 Import libraries
const axios = require('axios');
const fs = require('fs');

// 🔑 Your YouTube API key from .env
const API_KEY = process.env.YOUTUBE_API_KEY;

// 📺 List of video IDs to scan
const VIDEO_IDS = [
  'z51M9cit-X0',
  'dCoELp77I9o',
  'SotKhV-kjfI',
  'q83Jw-TKHdw'
];

// 🧠 Main function to fetch and process video data
async function fetchVideoDetails(videoId) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
    const response = await axios.get(url);
    const video = response.data.items[0];

    if (!video) {
      console.log("❌ Video not found or invalid ID.");
      return;
    }

    const { title, description } = video.snippet;

    console.log(`🎬 Title: ${title}`);
    console.log(`📝 Description:\n${description}`);

    const foundCodes = extractCodes(description);

    const videoData = {
      videoTitle: title,
      videoId: videoId,
      codes: foundCodes,
      timestamp: new Date().toISOString()
    };

    console.log("📦 JSON Data Object:");
    console.log(videoData);

    if (foundCodes.length === 0) {
      console.log("❌ No codes found.");
    } else {
      console.log("✅ Found codes:");
      foundCodes.forEach(code => console.log(`🔗 ${code}`));
    }

    // 💾 Save to results.json (append mode)
    appendToResults(videoData);

  } catch (err) {
    console.error("❌ Error fetching video data:", err.message);
  }
}

// 🔍 Extract codes using regex patterns
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

// 💽 Append results to results.json
function appendToResults(videoData) {
  const filePath = 'results.json';
  let current = [];

  try {
    if (fs.existsSync(filePath)) {
      const file = fs.readFileSync(filePath, 'utf-8');
      current = JSON.parse(file);
    }
  } catch (err) {
    console.warn("⚠️ Could not read existing results. Starting fresh.");
  }

  current.push(videoData);
  fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
}

// 🚀 Run the extraction for each video
async function runAll() {
  for (const id of VIDEO_IDS) {
    console.log(`\n🎯 Checking video ID: ${id}`);
    await fetchVideoDetails(id);
  }
}

runAll();
