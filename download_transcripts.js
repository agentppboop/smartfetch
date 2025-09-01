const fs = require('fs').promises;
const path = require('path');
const fetchTranscript = require('./fetchTranscript');

// --- Configuration ---
// Add the YouTube video URLs you want to download transcripts for.
const VIDEO_URLS = [
    'https://www.youtube.com/watch?v=Uwmp16aSgdk',
    'https://www.youtube.com/watch?v=jXJODqfaJto',
    'https://www.youtube.com/watch?v=W4Oyvgj3QnI',
    'https://www.youtube.com/watch?v=-YMFw5LgHyk',
    'https://www.youtube.com/watch?v=F3jY2I1FWGE',
    'https://www.youtube.com/watch?v=V9XCNzoJRiU',
    'https://www.youtube.com/watch?v=cUm2KM4GKgY'
  // Add 50-100 of your target video URLs here
];

const OUTPUT_DIR = path.join(__dirname, 'transcripts');
// --- End Configuration ---

/**
 * Extracts the video ID from various YouTube URL formats.
 * @param {string} url The YouTube URL.
 * @returns {string|null} The extracted video ID or null if not found.
 */
function extractVideoIdFromUrl(url) {
    try {
        const patterns = [
            /(?:v=|\/)([a-zA-Z0-9_-]{11}).*/,
            /(?:embed\/|v\/|shorts\/|watch\?v=)([a-zA-Z0-9_-]{11})/,
            /youtu\.be\/([a-zA-Z0-9_-]{11})/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}


/**
 * Main function to download and save transcripts.
 */
async function downloadAllTranscripts() {
  console.log(`🚀 Starting transcript download process for ${VIDEO_URLS.length} videos...`);

  try {
    // 1. Ensure the output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Saving transcripts to: ${OUTPUT_DIR}`);

    let successCount = 0;
    let errorCount = 0;

    // 2. Loop through each video URL and fetch the transcript
    for (const videoUrl of VIDEO_URLS) {
      const videoId = extractVideoIdFromUrl(videoUrl);
      if (!videoId) {
          console.warn(`⚠️ Could not extract video ID from URL: ${videoUrl}. Skipping.`);
          errorCount++;
          continue;
      }
        
      const filePath = path.join(OUTPUT_DIR, `${videoId}.txt`);

      try {
        console.log(`[${successCount + errorCount + 1}/${VIDEO_URLS.length}] Fetching transcript for video ID: ${videoId}`);
        const transcriptLines = await fetchTranscript(videoId); // Using your existing function

        if (transcriptLines && transcriptLines.length > 0) {
          const transcriptText = transcriptLines.join('\n');
          await fs.writeFile(filePath, transcriptText, 'utf-8');
          console.log(`✅ Successfully saved transcript for ${videoId}`);
          successCount++;
        } else {
          console.warn(`⚠️ No transcript found for ${videoId}. Skipping.`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to process video ${videoId}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n--- Download Complete ---');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed/Skipped: ${errorCount}`);
    console.log('-------------------------');

  } catch (error) {
    console.error('An unexpected error occurred during the download process:', error);
  }
}

// Run the main function
downloadAllTranscripts();