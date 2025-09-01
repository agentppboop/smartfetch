// SmartFetch Offscreen Script
// This script runs in a hidden offscreen document, allowing it to use the DOM APIs
// needed for fetching and parsing, without being affected by the YouTube page's
// Content Security Policy (CSP).

/**
 * Listens for messages from the background script (service worker).
 * When it receives a 'FETCH_TRANSCRIPT' request specifically targeted
 * to 'offscreen', it fetches the provided URL.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Only process messages specifically targeted to the offscreen document.
    if (request.target === 'offscreen' && request.type === 'FETCH_TRANSCRIPT') {
        console.log('Offscreen: Received request to fetch URL:', request.url);
        
        fetch(request.url)
            .then(response => {
                // Check if the network response is successful.
                if (!response.ok) {
                    throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
                }
                // Return the response body as text.
                return response.text();
            })
            .then(data => {
                // On success, send the data back.
                console.log(`Offscreen: Successfully fetched data (length: ${data.length}).`);
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                // On failure, send an error message back.
                console.error('Offscreen: Fetch error:', error.message);
                sendResponse({ success: false, error: error.message });
            });

        // Return true to indicate that the response will be sent asynchronously.
        return true;
    }
});
