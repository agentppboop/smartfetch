// Injected script: runs in page context, not content script
(function() {
    if (window.SmartFetchPageTranscriberInjected) return;
    window.SmartFetchPageTranscriberInjected = true;

    window.addEventListener('SmartFetchGetTranscript', function(event) {
        const url = event.detail && event.detail.url;
        if (!url) return;
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.withCredentials = true;
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        window.dispatchEvent(new CustomEvent('SmartFetchTranscriptResult', {
                            detail: { url, text: xhr.responseText }
                        }));
                    } else {
                        window.dispatchEvent(new CustomEvent('SmartFetchTranscriptResult', {
                            detail: { url, error: 'XHR failed: ' + xhr.status }
                        }));
                    }
                }
            };
            xhr.onerror = function() {
                window.dispatchEvent(new CustomEvent('SmartFetchTranscriptResult', {
                    detail: { url, error: 'XHR network error' }
                }));
            };
            xhr.send();
        } catch (e) {
            window.dispatchEvent(new CustomEvent('SmartFetchTranscriptResult', {
                detail: { url, error: e.message }
            }));
        }
    });
})();
