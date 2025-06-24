// nextPageToken.js - CORRECTED VERSION WITH ROBUST ERROR HANDLING

const axios = require('axios');
const axiosRetry = require('axios-retry');

// Configure axios retry with better error handling
axiosRetry(axios, { 
    retries: 3,
    retryDelay: retryCount => Math.min(1000 * 2 ** retryCount, 10000),
    retryCondition: err => {
        return err.response?.status === 400 || 
               err.response?.status === 429 || 
               err.response?.status >= 500;
    }
});

const cache = new Map();

async function getCachedOrFetch(url, params) {
    const key = `${url}:${JSON.stringify(params)}`;
    
    if (cache.has(key)) {
        console.log('⚡ Using cached response for:', key.substring(0, 100) + '...');
        return cache.get(key);
    }

    try {
        const res = await axios.get(url, { 
            params,
            timeout: 10000,
            headers: {
                'User-Agent': 'YouTubeAPI-Client/1.0'
            }
        });
        cache.set(key, res.data);
        return res.data;
    } catch (error) {
        console.error('Error in getCachedOrFetch:', error.message);
        if (error.response?.data) {
            console.error('API Error Details:', error.response.data);
        }
        throw error;
    }
}

// Enhanced channel ID validation
function validateChannelId(channelId) {
    if (!channelId) {
        throw new Error('Channel ID is required');
    }
    
    // YouTube channel IDs should start with UC and be 24 characters long
    if (!channelId.startsWith('UC') || channelId.length !== 24) {
        throw new Error(`Invalid channel ID format: ${channelId}. Expected format: UC followed by 22 characters`);
    }
    
    // Check for valid characters (alphanumeric, hyphens, underscores)
    if (!/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
        throw new Error(`Invalid channel ID characters: ${channelId}`);
    }
    
    return true;
}
async function fetchChannelVideos(channelId, apiKey, maxResults = 10) {
    try {
        // Strict channel ID validation - early return for invalid IDs
        if (!isStrictlyValidChannelId(channelId)) {
            console.error(`❌ Skipping invalid channel ID: ${channelId}`);
            return { 
                channelId, 
                videoIds: [], 
                videos: [],
                channelTitle: '',
                totalResults: 0,
                success: false, 
                error: 'Invalid channel ID format',
                errorType: 'invalid_channel_id'
            };
        }

        // Enhanced channel ID validation
        if (!channelId || typeof channelId !== 'string') {
            throw new Error('Valid channel ID is required');
        }
        
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('YouTube API key is required');
        }

        console.log(`🔍 Fetching videos for channel: ${channelId}`);
        
        // Clean parameters - remove potentially problematic ones
        const params = {
            part: 'snippet',
            channelId: channelId.trim(),
            type: 'video',
            order: 'date',
            maxResults: Math.min(Math.max(1, maxResults), 50), // Ensure between 1-50
            key: apiKey.trim()
        };

        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params,
            timeout: 15000,
            headers: {
                'User-Agent': 'YouTubeAPI-Client/1.0',
                'Accept': 'application/json'
            }
        });

        const items = response.data.items || [];
        
        if (items.length === 0) {
            console.log(`⚠️ No videos found for channel: ${channelId}`);
        } else {
            console.log(`✅ Found ${items.length} videos for channel: ${channelId}`);
        }

        return {
            channelId,
            videoIds: items.map(item => item.id?.videoId).filter(Boolean),
            videos: items.map(item => ({
                videoId: item.id?.videoId,
                title: item.snippet?.title || 'No Title',
                description: item.snippet?.description || '',
                publishedAt: item.snippet?.publishedAt,
                thumbnails: item.snippet?.thumbnails || {},
                channelTitle: item.snippet?.channelTitle || ''
            })).filter(video => video.videoId), // Filter out invalid videos
            channelTitle: items[0]?.snippet?.channelTitle || '',
            totalResults: response.data.pageInfo?.totalResults || 0,
            success: true
        };

    } catch (error) {
        console.error(`❌ Error fetching videos for channel ${channelId}:`, error.message);
        
        // Categorize error types for better handling
        let errorType = 'generic';
        
        if (error.response?.status === 400) {
            const errorMessage = error.response.data?.error?.message || '';
            
            if (errorMessage.includes('API key') || errorMessage.includes('key')) {
                console.error('🔑 Invalid API key');
                errorType = 'invalid_key';
            } else if (errorMessage.includes('channelId') || errorMessage.includes('channel')) {
                console.error('📺 Invalid channel ID');
                errorType = 'invalid_channel';
            } else {
                console.error('📋 Invalid request parameters');
                errorType = 'invalid_params';
            }
            
            console.error('🔍 API returned 400 Bad Request. Debugging info:');
            console.error('- Request URL:', error.config?.url);
            console.error('- Request params:', error.config?.params);
            console.error('- Response data:', error.response?.data);
            
            const errorDetails = error.response.data?.error;
            if (errorDetails) {
                console.error('- Error details:', {
                    code: errorDetails.code,
                    message: errorDetails.message,
                    errors: errorDetails.errors
                });
            }
        } else if (error.response?.status === 403) {
            console.error('🔍 API quota exceeded or invalid API key');
            errorType = 'quota_exceeded';
        } else if (error.response?.status === 404) {
            console.error('🔍 Channel not found or API endpoint incorrect');
            errorType = 'not_found';
        } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            console.error('⏱️ Request timeout');
            errorType = 'timeout';
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            console.error('🌐 Network connection error');
            errorType = 'network_error';
        }
        
        return {
            channelId,
            videoIds: [],
            videos: [],
            channelTitle: '',
            totalResults: 0,
            success: false,
            error: error.message,
            errorType,
            statusCode: error.response?.status,
            errorDetails: error.response?.data?.error
        };
    }
}

// Strict channel ID validation function
function isStrictlyValidChannelId(channelId) {
    if (!channelId || typeof channelId !== 'string') {
        return false;
    }
    
    // Must be exactly 24 characters starting with 'UC'
    const channelIdRegex = /^UC[a-zA-Z0-9_-]{22}$/;
    return channelIdRegex.test(channelId.trim());
}

// Helper function to validate and convert different channel ID formats
function normalizeChannelId(input) {
    if (!input || typeof input !== 'string') {
        throw new Error('Invalid channel input');
    }
    
    input = input.trim();
    
    // If it's already a channel ID (starts with UC)
    if (input.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
        return input;
    }
    
    // If it's a custom URL or handle, you'll need to use the channels API first
    // to get the actual channel ID
    throw new Error('Channel ID must be in UC format. Use YouTube API channels endpoint to convert custom URLs/handles to channel IDs first.');
}

// Alternative function to get channel ID from custom URL or handle
async function getChannelIdFromHandle(handleOrCustomUrl, apiKey) {
    try {
        let forHandle = null;
        let forUsername = null;
        
        // Determine if it's a handle (@username) or custom URL
        if (handleOrCustomUrl.startsWith('@')) {
            forHandle = handleOrCustomUrl;
        } else {
            forUsername = handleOrCustomUrl;
        }
        
        const params = {
            part: 'id,snippet',
            key: apiKey
        };
        
        if (forHandle) {
            params.forHandle = forHandle;
        } else {
            params.forUsername = forUsername;
        }
        
        const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
            params,
            timeout: 10000
        });
        
        const items = response.data.items || [];
        if (items.length === 0) {
            throw new Error('Channel not found');
        }
        
        return {
            channelId: items[0].id,
            channelTitle: items[0].snippet.title,
            success: true
        };
        
    } catch (error) {
        console.error('Error getting channel ID:', error.message);
        return {
            channelId: null,
            channelTitle: '',
            success: false,
            error: error.message
        };
    }
}
// Helper function to validate and convert different channel ID formats
function normalizeChannelId(input) {
    if (!input || typeof input !== 'string') {
        throw new Error('Invalid channel input');
    }
    
    input = input.trim();
    
    // If it's already a channel ID (starts with UC)
    if (input.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
        return input;
    }
    
    // If it's a custom URL or handle, you'll need to use the channels API first
    // to get the actual channel ID
    throw new Error('Channel ID must be in UC format. Use YouTube API channels endpoint to convert custom URLs/handles to channel IDs first.');
}

// Alternative function to get channel ID from custom URL or handle
async function getChannelIdFromHandle(handleOrCustomUrl, apiKey) {
    try {
        let forHandle = null;
        let forUsername = null;
        
        // Determine if it's a handle (@username) or custom URL
        if (handleOrCustomUrl.startsWith('@')) {
            forHandle = handleOrCustomUrl;
        } else {
            forUsername = handleOrCustomUrl;
        }
        
        const params = {
            part: 'id,snippet',
            key: apiKey
        };
        
        if (forHandle) {
            params.forHandle = forHandle;
        } else {
            params.forUsername = forUsername;
        }
        
        const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
            params,
            timeout: 10000
        });
        
        const items = response.data.items || [];
        if (items.length === 0) {
            throw new Error('Channel not found');
        }
        
        return {
            channelId: items[0].id,
            channelTitle: items[0].snippet.title,
            success: true
        };
        
    } catch (error) {
        console.error('Error getting channel ID:', error.message);
        return {
            channelId: null,
            channelTitle: '',
            success: false,
            error: error.message
        };
    }
}

async function* processVideosStream(videoIds) {
  for (let i = 0; i < videoIds.length; i += 5) {
    const batch = videoIds.slice(i, i + 5);
    for (const videoId of batch) {
      yield await processVideoDetailed(videoId);
    }
  }
}


// Enhanced version that handles pagination
async function fetchAllVideos(channelId, apiKey, options = {}) {
    const {
        maxResults = 50,
        maxTotalVideos = 500,
        order = 'date'
    } = options;

    try {
        validateChannelId(channelId);
        
        if (!apiKey) {
            throw new Error('YouTube API key is required');
        }

        let videos = [];
        let nextPageToken = '';
        const baseUrl = 'https://www.googleapis.com/youtube/v3/search';
        let totalRequests = 0;
        const maxRequests = Math.ceil(maxTotalVideos / 50);

        console.log(`📦 Fetching all videos for channel: ${channelId} (max: ${maxTotalVideos})`);

        do {
            try {
                totalRequests++;
                console.log(`🔄 Request ${totalRequests}/${maxRequests} - Page token: ${nextPageToken || 'first page'}`);
                
                const data = await getCachedOrFetch(baseUrl, {
                    key: apiKey,
                    channelId,
                    part: 'snippet',
                    type: 'video',
                    maxResults: Math.min(maxResults, 50),
                    order,
                    pageToken: nextPageToken,
                    safeSearch: 'none',
                    videoEmbeddable: 'any'
                });

                const items = data.items || [];
                videos.push(...items);
                nextPageToken = data.nextPageToken || '';
                
                console.log(`✅ Fetched ${items.length} videos (total: ${videos.length})`);
                
                // Stop if we've reached our limit
                if (videos.length >= maxTotalVideos) {
                    console.log(`🛑 Reached maximum video limit: ${maxTotalVideos}`);
                    videos = videos.slice(0, maxTotalVideos);
                    break;
                }
                
                // Add delay to respect rate limits
                if (nextPageToken && totalRequests < maxRequests) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
            } catch (error) {
                console.error(`❌ Error on request ${totalRequests}:`, error.message);
                
                if (error.response?.status === 403) {
                    console.error('Quota exceeded or API key invalid');
                    break;
                }
                
                if (error.response?.status === 400) {
                    console.error('Bad request - check parameters');
                    break;
                }
                
                // For other errors, try to continue
                if (totalRequests >= 3) {
                    console.error('Too many consecutive errors, stopping');
                    break;
                }
            }
        } while (nextPageToken && totalRequests < maxRequests);

        console.log(`🎯 Final result: ${videos.length} videos fetched in ${totalRequests} requests`);

        return {
            channelId,
            videoIds: videos.map(item => item.id.videoId).filter(Boolean),
            videos: videos.map(item => ({
                videoId: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                publishedAt: item.snippet.publishedAt,
                thumbnails: item.snippet.thumbnails
            })),
            channelTitle: videos[0]?.snippet.channelTitle || '',
            totalResults: videos.length,
            totalRequests,
            success: true
        };

    } catch (error) {
        console.error(`❌ Fatal error in fetchAllVideos:`, error.message);
        return {
            channelId,
            videoIds: [],
            videos: [],
            channelTitle: '',
            totalResults: 0,
            success: false,
            error: error.message
        };
    }
}

// Utility function to get channel info
async function getChannelInfo(channelId, apiKey) {
    try {
        validateChannelId(channelId);
        
        const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
            params: {
                part: 'snippet,statistics',
                id: channelId,
                key: apiKey
            }
        });

        const channel = response.data.items?.[0];
        if (!channel) {
            throw new Error('Channel not found');
        }

        return {
            channelId,
            title: channel.snippet.title,
            description: channel.snippet.description,
            publishedAt: channel.snippet.publishedAt,
            thumbnails: channel.snippet.thumbnails,
            statistics: channel.statistics,
            success: true
        };

    } catch (error) {
        console.error(`❌ Error fetching channel info:`, error.message);
        return {
            channelId,
            success: false,
            error: error.message
        };
    }
}

// Clear cache utility
function clearCache() {
    cache.clear();
    console.log('🗑️ API cache cleared');
}

// Get cache stats
function getCacheStats() {
    return {
        size: cache.size,
        keys: Array.from(cache.keys()).map(key => key.substring(0, 100) + '...')
    };
}

module.exports = {
    fetchAllVideos,
    fetchChannelVideos,
    getChannelInfo,
    getCachedOrFetch,
    validateChannelId,
    clearCache,
    getCacheStats
};