// nextPageToken.js - CORRECTED VERSION

const axios = require('axios');
const axiosRetry = require('axios-retry');

// Configure axios retry
axiosRetry(axios, { retries: 3 });

const cache = new Map();

async function getCachedOrFetch(url, params) {
    const key = `${url}:${JSON.stringify(params)}`;
    
    if (cache.has(key)) {
        console.log('⚡ Using cached response for:', key);
        return cache.get(key);
    }

    try {
        const res = await axios.get(url, { params });
        cache.set(key, res.data);
        return res.data;
    } catch (error) {
        console.error('Error in getCachedOrFetch:', error.message);
        throw error;
    }
}

async function fetchAllVideos(channelId, apiKey) {
    if (!channelId || !apiKey) {
        throw new Error('channelId and apiKey are required');
    }

    let videos = [];
    let nextPageToken = '';
    const baseUrl = `https://www.googleapis.com/youtube/v3/search`;

    do {
        try {
            const data = await getCachedOrFetch(baseUrl, {
                key: apiKey,
                channelId,
                part: 'snippet',
                type: 'video',
                maxResults: 50,
                order: 'date',
                pageToken: nextPageToken,
            });

            videos.push(...data.items);
            nextPageToken = data.nextPageToken || '';
            
            // Add delay to respect rate limits
            if (nextPageToken) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
        } catch (error) {
            console.error('Error fetching videos:', error.message);
            break;
        }
    } while (nextPageToken);

    return videos;
}

module.exports = {
    fetchAllVideos,
    getCachedOrFetch
};
