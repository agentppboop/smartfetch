// runMvp.js - The main pipeline for the SmartFetch Reddit MVP

require('dotenv').config();
const { fetchRedditPosts } = require('./fetchReddit.js'); // Your new tool
const { extractFromTranscript } = require('./textExtract.js');
const scoreMatch = require('./scoreMatch.js');
const syncToSheet = require('./syncToSheet.js');

const TARGET_SUBREDDITS = ['deals', 'GameDeals', 'buildapcsales', 'frugal'];
const CONFIDENCE_THRESHOLD = 0.6; // Only save results with a score of 60% or higher

async function runPipeline() {
    console.log('🚀 Starting SmartFetch MVP Pipeline...');

    // 1. FETCH data from Reddit
    const posts = await fetchRedditPosts(TARGET_SUBREDDITS);
    console.log(`✅ Fetched ${posts.length} posts from Reddit.`);

    const validResults = [];

    // 2. PROCESS each post
for (const post of posts) {
    const textToProcess = `${post.title} ${post.body}`;

    // 2a. EXTRACT codes using your existing regex engine
    const extractionResult = await extractFromTranscript(textToProcess); // <-- FIXED HERE

    if (!extractionResult || !extractionResult.codes || extractionResult.codes.length === 0) {
        continue; // Skip posts where no codes were found
    }

    // 2b. SCORE the result
    const confidence = scoreMatch({
        ...extractionResult,
    });

    // 3. DECIDE if the result is good enough to save
    if (confidence >= CONFIDENCE_THRESHOLD) {
        const result = {
    videoId: post.id,
    videoTitle: post.title,
    sourceUrl: post.url, // <-- CORRECTED HERE
    timestamp: new Date(post.created_utc * 1000).toISOString(),
    ...extractionResult,
    confidence
};
validResults.push(result);
    }
}

    console.log(`🎯 Found ${validResults.length} high-confidence results worth saving.`);

    // 4. SAVE the valid results to your Google Sheet
    for (const result of validResults) {
        await syncToSheet(result);
    }

    console.log('✅ Pipeline finished. Your Google Sheet and dashboard should be updated.');
}

runPipeline();