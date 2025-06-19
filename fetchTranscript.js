// fetchTranscript.js
const axios = require('axios');
require('dotenv').config();

async function fetchTranscript(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const url = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
  
  // Placeholder dummy transcript for now
  return [
    "Use code SAVE20 to get a discount!",
    "Redeem GIFT-9K2H now!",
    "Try ABC123 for 10% off."
  ];
}

module.exports = fetchTranscript;
