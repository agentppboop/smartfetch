async function fetchAllVideos(channelId, apiKey) {
  let videos = [];
  let nextPageToken = '';
  const baseUrl = `https://www.googleapis.com/youtube/v3/search`;

  do {
    const res = await axios.get(baseUrl, {
      params: {
        key: apiKey,
        channelId,
        part: 'snippet',
        maxResults: 50,
        order: 'date',
        pageToken: nextPageToken,
      }
    });

    videos.push(...res.data.items);
    nextPageToken = res.data.nextPageToken || '';
  } while (nextPageToken);

  return videos;
}
const axios = require('axios');
const axiosRetry = require('axios-retry');

axiosRetry(axios, {
  retries: 5,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (err) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(err) || err.response?.status === 429;
  },
});

const cache = new Map();

async function getCachedOrFetch(url, params) {
  const key = `${url}:${JSON.stringify(params)}`;
  if (cache.has(key)) {
    console.log('⚡ Using cached response for:', key);
    return cache.get(key);
  }

  const res = await axios.get(url, { params });
  cache.set(key, res.data);
  return res.data;
}
