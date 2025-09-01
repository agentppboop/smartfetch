// SmartFetch Content Script
console.log('SmartFetch: Content script loaded');

// --- Global State ---
let isInitialized = false;
let initializationInterval = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 60; // Use uppercase for constants
let smartFetchTranscript = null;
let currentVideoId = null;


// --- Initialization ---

/**
 * Starts the process of trying to find the YouTube player and its data.
 * It polls the page until it finds what it needs or times out.
 */
function startInitialization() {
    // Prevent re-initialization if already running or completed
    if (isInitialized || initializationInterval) {
        console.log('SmartFetch: Initialization already in progress or completed.');
        return;
    }

    console.log('SmartFetch: Starting initialization process...');
    initAttempts = 0;

    // Poll every 500ms to find the necessary YouTube player data.
    initializationInterval = setInterval(attemptInitialization, 500);
    attemptInitialization(); // Try immediately without waiting for the interval
}

/**
 * A single attempt to find the video element and player data.
 * This function is the core of the polling mechanism.
 */
function attemptInitialization() {
    if (isInitialized) {
        stopInitialization();
        return;
    }

    initAttempts++;
    console.log(`SmartFetch: Polling attempt ${initAttempts}/${MAX_INIT_ATTEMPTS} for YouTube player data...`);

    const videoElement = document.querySelector('video');
    const isVideoPage = window.location.pathname === '/watch';

    // If we don't have a video element on a watch page, it's not ready yet.
    if (!videoElement || !isVideoPage) {
        if (initAttempts >= MAX_INIT_ATTEMPTS) {
            console.log('SmartFetch: Max attempts reached. Could not find video element on a watch page.');
            stopInitialization();
        }
        return;
    }

    // Try to find the player response data from various sources YouTube might use.
    const playerResponse = findYouTubePlayerResponse();
    console.log('SmartFetch: Player response found:', !!playerResponse);

    // Debug: Log the captions object for analysis
    if (playerResponse && playerResponse.captions) {
        console.log('SmartFetch: playerResponse.captions:', JSON.stringify(playerResponse.captions, null, 2));
    } else {
        console.log('SmartFetch: playerResponse.captions is missing or undefined.');
    }

    const hasCaptions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length > 0;

    // Success condition: We have everything we need.
    if (videoElement && isVideoPage && hasCaptions) {
        console.log('SmartFetch: Video element, video page, and caption data confirmed. Initializing...');
        completeInitialization(videoElement, playerResponse);
        return;
    }

    // Fallback: If we have a video but no player response after a while, try to proceed anyway.
    if (videoElement && isVideoPage && initAttempts > 30) {
        console.log('SmartFetch: Video found but no complete player response after 30 attempts. Proceeding with what we have...');
        completeInitialization(videoElement, playerResponse);
        return;
    }

    // Timeout condition: Stop polling if we've tried too many times.
    if (initAttempts >= MAX_INIT_ATTEMPTS) {
        console.log('SmartFetch: Max initialization attempts reached. Stopping polling.');
        // Last resort: try to initialize with whatever we found.
        if (videoElement && isVideoPage && !isInitialized) {
            console.log('SmartFetch: Last resort initialization...');
            completeInitialization(videoElement, playerResponse);
        } else {
            stopInitialization();
        }
    }
}

/**
 * Searches for YouTube's internal player data object in various possible locations.
 * @returns {object|null} The player response object or null if not found.
 */
function findYouTubePlayerResponse() {
    // The most common and direct location.
    if (window.ytInitialPlayerResponse) {
        console.log('SmartFetch: Found player response via window.ytInitialPlayerResponse');
        return window.ytInitialPlayerResponse;
    }

    // An older, but still possible location.
    if (window.ytplayer?.config?.args?.player_response) {
        try {
            console.log('SmartFetch: Found player response via ytplayer.config.args.player_response');
            return JSON.parse(window.ytplayer.config.args.player_response);
        } catch (e) {
            console.error('SmartFetch: Failed to parse ytplayer.config.args.player_response', e);
        }
    }
    
    // Search within script tags as a last resort. This is less reliable.
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
        const content = script.textContent;
        if (content?.includes('ytInitialPlayerResponse')) {
            try {
                // Extract the JSON part of the script content.
                const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
                if (match && match[1]) {
                    console.log('SmartFetch: Found player response in a script tag.');
                    return JSON.parse(match[1]);
                }
            } catch (e) {
                console.error('SmartFetch: Failed to parse player response from script tag.', e);
            }
        }
    }

    return null;
}


/**
 * Finalizes the initialization, sets up event listeners, and stops polling.
 * @param {HTMLVideoElement} videoElement - The main video element.
 * @param {object} playerResponse - The YouTube player data object.
 */
function completeInitialization(videoElement, playerResponse) {
    console.log('SmartFetch: Completing initialization...');
    isInitialized = true;
    window.smartFetchPlayerResponse = playerResponse; // Store for later access

    stopInitialization(); // Crucial to stop the polling interval.

    setupVideoMonitoring(videoElement);
    console.log('SmartFetch: Initialization complete.');
}

/**
 * Stops the initialization interval.
 */
function stopInitialization() {
    if (initializationInterval) {
        console.log('SmartFetch: Stopping initialization polling.');
        clearInterval(initializationInterval);
        initializationInterval = null;
    }
}


// --- Video Monitoring & Transcript Extraction ---

/**
 * Sets up event listeners on the video element to react to playback events.
 * @param {HTMLVideoElement} videoElement
 */
function setupVideoMonitoring(videoElement) {
    console.log('SmartFetch: Setting up video monitoring.');

    // Function to run when metadata is loaded or when playback starts.
    const onVideoReady = async () => {
        const videoInfo = getVideoInfo();
        currentVideoId = videoInfo.videoId;

        // Only extract if we haven't already for this video.
        if (!smartFetchTranscript) {
            console.log('SmartFetch: Attempting to extract transcript...');
            const transcript = await getTranscriptFromYouTubeData();
            if (transcript) {
                smartFetchTranscript = transcript;
                console.log('SmartFetch: Transcript extracted and stored.');
            } else {
                console.log('SmartFetch: No transcript could be extracted for this video.');
            }
        }

        const fullData = {
            ...videoInfo,
            transcript: smartFetchTranscript,
            hasTranscript: !!smartFetchTranscript,
        };

        // Notify other parts of the extension that a video is ready.
        chrome.runtime.sendMessage({ type: 'VIDEO_DETECTED', data: fullData }, () => {
             if (chrome.runtime.lastError) {
                console.log(`SmartFetch: Could not send VIDEO_DETECTED message. ${chrome.runtime.lastError.message}`);
            }
        });
    };

    // Listen for the 'loadedmetadata' event, which is a good time to get initial data.
    videoElement.addEventListener('loadedmetadata', onVideoReady);
    
    // Also handle the 'play' event, as sometimes data is available then.
    videoElement.addEventListener('play', onVideoReady);

    console.log('SmartFetch: Video monitoring setup complete.');
}

/**
 * Extracts the transcript by sending the URL to the background script for fetching.
 * @returns {Promise<Array|null>} A promise that resolves to the transcript array or null.
 */
async function getTranscriptFromYouTubeData() {
    const playerResponse = window.smartFetchPlayerResponse;
    if (!playerResponse) {
        console.log('SmartFetch: Player response not available for transcript extraction.');
        return null;
    }
    const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || captionTracks.length === 0) {
        if (playerResponse && playerResponse.captions) {
            console.log('SmartFetch: Captions object (no captionTracks):', JSON.stringify(playerResponse.captions, null, 2));
        }
        console.log('SmartFetch: No caption tracks found in player data.');
        return null;
    }
    console.log(`SmartFetch: Found ${captionTracks.length} caption tracks.`);
    const sortedTracks = [...captionTracks].sort((a, b) => {
        const langA = a.languageCode.startsWith('en');
        const langB = b.languageCode.startsWith('en');
        if (langA !== langB) return langA ? -1 : 1;
        const asrA = a.kind === 'asr';
        const asrB = b.kind === 'asr';
        if (asrA !== asrB) return asrA ? -1 : 1;
        return 0;
    });
    for (const track of sortedTracks) {
        if (!track.baseUrl) {
            console.log(`SmartFetch: Skipping track (${track.languageCode}) - no baseUrl.`);
            continue;
        }
        console.log(`SmartFetch: Trying track (${track.languageCode}): ${track.name?.simpleText}`);
        try {
            // Fetch the transcript XML using the injected page context script
            console.log(`SmartFetch: Fetching transcript XML via page context from: ${track.baseUrl}`);
            const xmlText = await fetchTranscriptViaPageContext(track.baseUrl);
            console.log(`SmartFetch: Received XML text from page context (length: ${xmlText.length}).`);
            const parsedTranscript = parseTranscriptXML(xmlText);
            if (parsedTranscript && parsedTranscript.length > 0) {
                console.log(`SmartFetch: Successfully parsed transcript from track (${track.languageCode}).`);
                return parsedTranscript;
            } else {
                console.log(`SmartFetch: Failed to parse a valid transcript from the received XML.`);
            }
        } catch (error) {
            console.error(`SmartFetch: CRITICAL: Error fetching transcript for track (${track.languageCode}).`, error);
        }
    }
    console.log('SmartFetch: All caption tracks failed to yield a valid transcript. Trying UI scraping...');
    // Try scraping transcript from the YouTube UI as a fallback
    const uiTranscript = await scrapeTranscriptFromUI();
    if (uiTranscript && uiTranscript.length > 0) {
        console.log('SmartFetch: Successfully scraped transcript from UI.');
        return uiTranscript;
    }
    console.log('SmartFetch: UI scraping also failed. No transcript available.');
    return null;
// --- UI Transcript Scraping Fallback ---
/**
 * Attempts to open the transcript panel and scrape transcript text from the YouTube UI.
 * @returns {Promise<Array|null>} Array of transcript segments or null.
 */
async function scrapeTranscriptFromUI() {
    // Try to open the transcript panel if not already open
    let transcriptButton = document.querySelector('ytd-menu-renderer ytd-menu-service-item-renderer[aria-label*="transcript" i], ytd-menu-renderer tp-yt-paper-item[aria-label*="transcript" i]');
    if (!transcriptButton) {
        // Open the "..." menu first if needed
        const menuButton = document.querySelector('ytd-menu-renderer yt-icon-button button, ytd-menu-renderer tp-yt-paper-icon-button');
        if (menuButton) menuButton.click();
        await new Promise(r => setTimeout(r, 500));
        transcriptButton = document.querySelector('ytd-menu-renderer ytd-menu-service-item-renderer[aria-label*="transcript" i], ytd-menu-renderer tp-yt-paper-item[aria-label*="transcript" i]');
    }
    if (transcriptButton) {
        transcriptButton.click();
        await new Promise(r => setTimeout(r, 1000)); // Wait for panel to open
    } else {
        console.log('SmartFetch: Could not find transcript button in UI.');
        return null;
    }

    // Now look for transcript lines in the panel
    const transcriptRows = document.querySelectorAll('ytd-transcript-segment-renderer, ytd-transcript-body-renderer div.cue-group');
    if (!transcriptRows || transcriptRows.length === 0) {
        console.log('SmartFetch: No transcript rows found in UI.');
        return null;
    }
    const transcript = [];
    transcriptRows.forEach(row => {
        // Try to get time and text
        let start = 0, duration = 0, text = '';
        // For new UI
        const cue = row.querySelector('.segment-timestamp, .cue-group-start-offset');
        const cueText = row.querySelector('.segment-text, .cue-group-text');
        if (cue && cueText) {
            text = cueText.textContent.trim();
            // Optionally parse time from cue.textContent
        } else {
            // Fallback: just get all text
            text = row.textContent.trim();
        }
        if (text) transcript.push({ start, duration, text });
    });
    return transcript.length > 0 ? transcript : null;
}
}

/**
 * Parses the XML transcript format from YouTube.
 * @param {string} xmlText - The raw XML string from the caption track URL.
 * @returns {Array|null} An array of transcript segments or null.
 */
function parseTranscriptXML(xmlText) {
    if (!xmlText || xmlText.trim().length === 0) {
        console.log('SmartFetch: parseTranscriptXML received empty text.');
        return null;
    }

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        if (xmlDoc.querySelector('parsererror')) {
            console.error('SmartFetch: XML parsing error detected in the response.');
            console.error('Failing XML:', xmlText);
            return null;
        }

        const textElements = xmlDoc.querySelectorAll('text');
        if (textElements.length === 0) {
            console.log('SmartFetch: XML is valid, but contains no <text> elements.');
            return null;
        }

        const transcript = [];
        const tempTextArea = document.createElement('textarea');

        textElements.forEach(element => {
            const start = parseFloat(element.getAttribute('start')) || 0;
            const duration = parseFloat(element.getAttribute('dur')) || 0;
            
            // Decode HTML entities (e.g., &#39; -> ') safely.
            tempTextArea.innerHTML = element.textContent || '';
            const text = tempTextArea.value;

            if (text.trim()) {
                transcript.push({
                    start: start,
                    duration: duration,
                    text: text.trim(),
                });
            }
        });

        return transcript.length > 0 ? transcript : null;
    } catch (error) {
        console.error('SmartFetch: Error executing parseTranscriptXML:', error);
        return null;
    }
}


// --- Helpers & Listeners ---

/**
 * Gathers basic information about the current video.
 * @returns {object} An object with video details.
 */
function getVideoInfo() {
    const videoElement = document.querySelector('video');
    const videoId = new URLSearchParams(window.location.search).get('v');
    const title = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string')?.textContent || document.title;

    return {
        videoId: videoId,
        title: title,
        url: window.location.href,
        duration: videoElement?.duration || 0,
        currentTime: videoElement?.currentTime || 0
    };
}

/**
 * Listens for messages from the popup. This is now an async handler that can
 * fetch the transcript on-demand if it hasn't been cached yet.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getRawTranscript') {
        (async () => {
            console.log('SmartFetch: Received request for raw transcript.');
            const videoInfo = getVideoInfo();

            // If transcript is already fetched, return it from cache.
            if (smartFetchTranscript) {
                console.log('SmartFetch: Returning cached transcript.');
                const fullText = smartFetchTranscript.map(segment => segment.text).join(' ');
                sendResponse({
                    status: 'Transcript found (from cache)',
                    videoTitle: videoInfo.title,
                    videoId: videoInfo.videoId,
                    transcript: fullText
                });
                return;
            }

            // If not cached, attempt to fetch it now.
            console.log('SmartFetch: No cached transcript. Attempting to fetch on-demand...');
            const transcript = await getTranscriptFromYouTubeData();
            
            if (transcript) {
                smartFetchTranscript = transcript; // Cache the result
                const fullText = transcript.map(segment => segment.text).join(' ');
                console.log('SmartFetch: On-demand fetch successful.');
                sendResponse({
                    status: 'Transcript fetched successfully',
                    videoTitle: videoInfo.title,
                    videoId: videoInfo.videoId,
                    transcript: fullText
                });
            } else {
                console.log('SmartFetch: On-demand fetch failed. No transcript available.');
                sendResponse({
                    status: 'No transcript available for this video',
                    videoTitle: videoInfo.title,
                    videoId: videoInfo.videoId,
                    transcript: null
                });
            }
        })();
        
        // Return true to indicate that the response will be sent asynchronously.
        return true;
    }
});


/**
 * Resets the script's state. Called when navigating to a new page.
 */
function resetState() {
    console.log('SmartFetch: Resetting state for new page navigation.');
    stopInitialization();
    isInitialized = false;
    smartFetchTranscript = null;
    currentVideoId = null;
    window.smartFetchPlayerResponse = null;
}

/**
 * Handles YouTube's single-page application (SPA) navigation.
 * When the URL changes, it resets and re-initializes the script.
 */
function observeNavigation() {
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('SmartFetch: URL changed to:', url);
            resetState();
            // Wait a moment for the new page content to begin loading, then start over.
            setTimeout(startInitialization, 500);
        }
    }).observe(document.body, { childList: true, subtree: true });
}


// --- Inject page context script for transcript fetch ---
function injectPageTranscriberScript() {
    if (document.getElementById('smartfetch-page-transcriber')) return;
    const script = document.createElement('script');
    script.id = 'smartfetch-page-transcriber';
    script.src = chrome.runtime.getURL('pageTranscriber.js');
    (document.head || document.documentElement).appendChild(script);
}

// Helper to fetch transcript XML from page context
function fetchTranscriptViaPageContext(url) {
    return new Promise((resolve, reject) => {
        function onResult(event) {
            if (!event.detail || event.detail.url !== url) return;
            window.removeEventListener('SmartFetchTranscriptResult', onResult);
            if (event.detail.error) {
                reject(new Error(event.detail.error));
            } else {
                resolve(event.detail.text);
            }
        }
        window.addEventListener('SmartFetchTranscriptResult', onResult);
        window.dispatchEvent(new CustomEvent('SmartFetchGetTranscript', { detail: { url } }));
    });
}

// Inject the page context script at startup
injectPageTranscriberScript();

// --- Script Entry Point ---
startInitialization();
observeNavigation();
