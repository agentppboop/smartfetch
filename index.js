// 🔁 Add this line near other constants
const INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours


const { GoogleSpreadsheet } = require('google-spreadsheet');
const syncToSheet = require('./syncToSheet');

// 📦 Load environment variables
require('dotenv').config();

// 🔗 Import libraries
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');

// 🔑 Your YouTube API key from .env
const API_KEY = process.env.YOUTUBE_API_KEY;

// 📺 List of YouTube links and playlist IDs
const VIDEO_LINKS = [
  'https://www.youtube.com/watch?v=z51M9cit-X0',
  'https://youtu.be/dCoELp77I9o',
  'https://youtube.com/shorts/SotKhV-kjfI',
  'https://www.youtube.com/watch?v=q83Jw-TKHdw'
];

const PLAYLIST_IDS = [
 // 'PLVD3APpfd1ts0x9qpHagm5Nyd2GKxwrly' // ✅ Only the ID, not the full URL
];

const CHANNEL_URLS = [
  // 'https://www.youtube.com/@Aideliotv',
  // 'https://www.youtube.com/channel/UCabc123xyz...'
];


// 🔎 Extract video ID from various YouTube URL formats
function extractVideoIdFromUrl(url) {
  try {
    const short = url.match(/youtu\.be\/([^\?\&]+)/);
    if (short) return short[1];

    const long = url.match(/[?&]v=([^&]+)/);
    if (long) return long[1];

    const shorts = url.match(/shorts\/([^\?\&]+)/);
    if (shorts) return shorts[1];

    return null;
  } catch {
    return null;
  }
}

// 📥 Fetch all video IDs from a playlist
async function fetchVideoIdsFromPlaylist(playlistId) {
  const videoIds = [];
  let nextPageToken = '';

  try {
    do {
      const res = await axios.get(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${playlistId}&pageToken=${nextPageToken}&key=${API_KEY}`
      );
      const items = res.data.items || [];
      items.forEach(item => videoIds.push(item.contentDetails.videoId));
      nextPageToken = res.data.nextPageToken || '';
    } while (nextPageToken);
  } catch (err) {
    console.error(`❌ Failed to fetch playlist ${playlistId}: ${err.message}`);
  }

  return videoIds;
}

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

    const codesByType = extractCodes(description);
    const flatCodes = Object.values(codesByType).flat();

    const videoData = {
      videoTitle: title,
      videoId: videoId,
      ...codesByType,
      timestamp: new Date().toISOString()
    };

    console.log("📦 JSON Data Object:");
    console.log(videoData);

    if (flatCodes.length === 0) {
      console.log("❌ No codes found.");
    } else {
      console.log("✅ Found codes:");
      flatCodes.forEach(code => console.log(`🔗 ${code}`));
    }

    // 💾 Save to results.json (append mode)
    appendToResults(videoData);
    exportToCSV(videoData);
    syncToSheet(videoData);

  } catch (err) {
    const errorMsg = `❌ Failed for video ID ${videoId}: ${err.message}\n`;
    console.error(errorMsg);
    fs.appendFileSync('errors.log', errorMsg);
  }
}

async function getUploadsPlaylistId(channelUrl) {
  try {
    let channelId;

    // Case: @handle
    if (channelUrl.includes('@')) {
      const username = channelUrl.split('@')[1].replace('/', '');
      const res = await axios.get(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${username}&key=${API_KEY}`
      );
      channelId = res.data.items[0]?.snippet?.channelId;
    } else {
      // Extract channel ID from URL
      const match = channelUrl.match(/channel\/([a-zA-Z0-9_-]+)/);
      channelId = match ? match[1] : null;
    }

    if (!channelId) throw new Error('Channel ID not found');

    // Get uploads playlist
    const res2 = await axios.get(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`
    );

    return res2.data.items[0]?.contentDetails?.relatedPlaylists?.uploads || null;
  } catch (err) {
    console.error(`❌ Failed to get uploads playlist from ${channelUrl}: ${err.message}`);
    return null;
  }
}


// 🔍 Extract codes by type using regex patterns
function extractCodes(text) {
  const patterns = {
    links: /https?:\/\/[^\s]+/g,
    alphanum: /\b[A-Z0-9]{5,}\b/g,
    useCode: /use code[:\- ]?([A-Z0-9]+)/gi,
    coupon: /coupon[:\- ]?([A-Z0-9]+)/gi,
    ref: /ref[:\- ]?([A-Z0-9]+)/gi,
    promo: /promo[:\- =]?([A-Z0-9]+)/gi
  };

  const results = {
    links: new Set(),
    codes: new Set()
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[1] || match[0];
      if (!['PROMO CODE', 'PROMO CODES', 'COUPON CODE', 'DISCLAIMER'].includes(value.toUpperCase())) {
        if (key === 'links') results.links.add(value.trim());
        else results.codes.add(value.trim());
      }
    }
  }

  return {
    links: Array.from(results.links),
    codes: Array.from(results.codes)
  };
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

  const alreadyExists = current.some(entry => entry.videoId === videoData.videoId);
  if (alreadyExists) {
    console.log("⏩ Skipping duplicate video entry.");
    return;
  }

  current.push(videoData);
  fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
}

// 🧾 Export data to CSV
function exportToCSV(videoData) {
  const csvPath = 'results.csv';
  const fields = ['videoId', 'videoTitle', 'timestamp', 'links', 'codes'];
  const opts = { fields, header: !fs.existsSync(csvPath) };
  const row = {
    ...videoData,
    links: videoData.links.join(' | '),
    codes: videoData.codes.join(' | ')
  };

  try {
    const csv = parse([row], opts) + '\n';
    fs.appendFileSync(csvPath, csv);
  } catch (err) {
    console.error("❌ CSV Export Error:", err.message);
  }
}

// 🚀 Run the extraction from both links and playlists
async function runAll() {
  const videoIds = new Set();

  for (const url of VIDEO_LINKS) {
    const videoId = extractVideoIdFromUrl(url);
    if (videoId) videoIds.add(videoId);
    else console.warn(`⚠️ Could not extract video ID from URL: ${url}`);
  }

  for (const playlistUrlOrId of PLAYLIST_IDS) {
    const playlistIdMatch = playlistUrlOrId.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    const playlistId = playlistIdMatch ? playlistIdMatch[1] : playlistUrlOrId;
    const idsFromPlaylist = await fetchVideoIdsFromPlaylist(playlistId);
    idsFromPlaylist.forEach(id => videoIds.add(id));
  }

  for (const id of videoIds) {
    console.log(`\n🎯 Checking video ID: ${id}`);
    await fetchVideoDetails(id);
  }

    for (const channelUrl of CHANNEL_URLS) {
    const uploadsPlaylistId = await getUploadsPlaylistId(channelUrl);
    if (uploadsPlaylistId) {
      console.log(`📺 Found uploads playlist: ${uploadsPlaylistId}`);
      PLAYLIST_IDS.push(uploadsPlaylistId);
    }
  }

}

// 🔁 Schedule periodic scans
//setInterval(runAll, INTERVAL_MS);

// ▶️ Initial run
runAll();

