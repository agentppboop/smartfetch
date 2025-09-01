// SmartFetch Background Script (service_worker)
console.log('SmartFetch BG: Service worker started.');

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// A helper function to create the offscreen document if it doesn't exist.
async function setupOffscreenDocument() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (existingContexts.length > 0) {
        console.log('SmartFetch BG: Offscreen document already exists.');
        return;
    }
    console.log('SmartFetch BG: Creating new offscreen document.');
    await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ['DOM_PARSER'],
        justification: 'Required for fetching and parsing transcript XML.',
    });
}

// Listen for messages from other parts of the extension.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // This listener is for messages from the content script or popup.
    // We ignore messages that are intended for the offscreen script.
    if (request.target === 'offscreen') {
        return false; // Does not return true, so other listeners can pick it up.
    }

    if (request.type === 'FETCH_TRANSCRIPT') {
        console.log(`SmartFetch BG: Received fetch request for URL: ${request.url}`);
        // Directly fetch the transcript XML from YouTube, including credentials (cookies) and browser-like headers
        fetch(request.url, {
            credentials: "include",
            headers: {
                "User-Agent": navigator.userAgent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": navigator.language || "en-US,en;q=0.9"
            }
        })
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.text();
            })
            .then(data => {
                sendResponse({ success: true, data });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        // Return true to indicate that the response will be sent asynchronously.
        return true;
    }
});
