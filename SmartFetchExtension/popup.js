// SmartFetchExtension/popup.js

document.addEventListener('DOMContentLoaded', () => {
    const statusElement = document.getElementById('status');
    const loaderElement = document.getElementById('loader');
    const resultsDiv = document.getElementById('results');
    const videoTitleElement = document.getElementById('videoTitle');
    const transcriptStatusElement = document.getElementById('transcriptStatus');
    const transcriptContentSection = document.getElementById('transcriptContentSection');
    const transcriptPreview = document.getElementById('transcriptPreview');
    const copyTranscriptBtn = document.getElementById('copyTranscriptBtn');
    const copyStatus = document.getElementById('copyStatus');
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    const copyCodeStatus = document.getElementById('copyCodeStatus');

    // Defensive: check all required elements exist
    if (!statusElement || !loaderElement || !resultsDiv || !videoTitleElement || !transcriptStatusElement || !transcriptContentSection || !transcriptPreview || !copyTranscriptBtn || !copyStatus || !copyCodeBtn || !copyCodeStatus) {
        console.error('[SmartFetch Popup] One or more required DOM elements are missing. Popup cannot function.');
        return;
    }

    function showStatus(message, isError = false) {
        statusElement.textContent = message;
        statusElement.className = isError ? 'status error' : 'status info';
        statusElement.style.display = 'block';
        resultsDiv.style.display = 'none';
        loaderElement.style.display = 'none';
    }

    function showLoader() {
        statusElement.style.display = 'none';
        loaderElement.style.display = 'block';
        resultsDiv.style.display = 'none';
    }

    function showResults(response) {
        statusElement.style.display = 'none';
        loaderElement.style.display = 'none';
        resultsDiv.style.display = 'block';

        videoTitleElement.textContent = response.videoTitle || 'Title not found';
        transcriptStatusElement.textContent = response.status || 'Unknown status';

        if (response.transcript) {
            transcriptContentSection.style.display = 'block';
            transcriptPreview.value = response.transcript.substring(0, 1000) + (response.transcript.length > 1000 ? '...' : '');
            copyTranscriptBtn.disabled = false;
            // Store the full transcript for copy
            transcriptPreview.dataset.fullTranscript = response.transcript;
        } else {
            transcriptContentSection.style.display = 'none';
            copyTranscriptBtn.disabled = true;
            transcriptPreview.dataset.fullTranscript = '';
        }
    }

    // Copy-to-Clipboard functionality
    copyTranscriptBtn.addEventListener('click', () => {
        // Always copy the full transcript, not just the preview
        const fullTranscript = transcriptPreview.dataset.fullTranscript || '';
        navigator.clipboard.writeText(fullTranscript)
            .then(() => {
                copyStatus.style.display = 'block';
                copyStatus.textContent = 'Copied!';
                copyStatus.style.color = 'green';
                setTimeout(() => { copyStatus.style.display = 'none'; }, 1200);
            })
            .catch(() => {
                copyStatus.textContent = 'Copy failed!';
                copyStatus.style.color = 'red';
                copyStatus.style.display = 'block';
                setTimeout(() => {
                    copyStatus.style.display = 'none';
                    copyStatus.textContent = 'Copied!';
                    copyStatus.style.color = 'green';
                }, 1500);
            });
    });

    // Copy as Code Block functionality
    copyCodeBtn.addEventListener('click', () => {
        const fullTranscript = transcriptPreview.dataset.fullTranscript || '';
        const codeBlock = '```\n' + fullTranscript + '\n```';
        navigator.clipboard.writeText(codeBlock)
            .then(() => {
                copyCodeStatus.style.display = 'block';
                copyCodeStatus.textContent = 'Copied as code!';
                copyCodeStatus.style.color = 'green';
                setTimeout(() => { copyCodeStatus.style.display = 'none'; }, 1200);
            })
            .catch(() => {
                copyCodeStatus.textContent = 'Copy failed!';
                copyCodeStatus.style.color = 'red';
                copyCodeStatus.style.display = 'block';
                setTimeout(() => {
                    copyCodeStatus.style.display = 'none';
                    copyCodeStatus.textContent = 'Copied as code!';
                    copyCodeStatus.style.color = 'green';
                }, 1500);
            });
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.url || !activeTab.url.startsWith('https://www.youtube.com/watch')) {
            showStatus("This is not a YouTube video page.", true);
            return;
        }
        
        showLoader();
        statusElement.textContent = "Requesting transcript from page...";

        // Request raw transcript from content script
        chrome.tabs.sendMessage(activeTab.id, { action: 'getRawTranscript' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("SmartFetch Popup: Error sending message:", chrome.runtime.lastError.message);
                showStatus("Could not connect to the page. Please refresh the YouTube tab and try again.", true);
                return;
            }

            if (response) {
                showResults(response);
            } else {
                showStatus("Received no response from the page. The content script might be blocked or not yet loaded.", true);
            }
        });
    });
});
