require('dotenv').config();
const snoowrap = require('snoowrap');

// Validate environment variables
const {
    REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET,
    REDDIT_REFRESH_TOKEN
} = process.env;

function validateEnv() {
    const missing = [];
    if (!REDDIT_CLIENT_ID) missing.push('REDDIT_CLIENT_ID');
    if (!REDDIT_CLIENT_SECRET) missing.push('REDDIT_CLIENT_SECRET');
    if (!REDDIT_REFRESH_TOKEN) missing.push('REDDIT_REFRESH_TOKEN');
    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

validateEnv();

const reddit = new snoowrap({
    userAgent: 'SmartFetchRedditScript/1.0 by SmartFetch',
    clientId: REDDIT_CLIENT_ID,
    clientSecret: REDDIT_CLIENT_SECRET,
    refreshToken: REDDIT_REFRESH_TOKEN
});

/**
 * Fetches top 50 hot posts from each subreddit in the list.
 * @param {string[]} subreddits - Array of subreddit names.
 * @returns {Promise<Array>} - Flattened array of post objects.
 */
async function fetchRedditPosts(subreddits) {
    if (!Array.isArray(subreddits)) throw new Error('subreddits must be an array of subreddit names');
    const allPosts = [];

    for (const subreddit of subreddits) {
        try {
            const posts = await reddit.getSubreddit(subreddit).getHot({ limit: 50 });
            const mapped = posts.map(post => ({
                id: post.id,
                title: post.title,
                body: post.selftext || '',
                url: `https://reddit.com${post.permalink}`,
                subreddit: post.subreddit.display_name,
                upvotes: post.ups,
                comment_count: post.num_comments,
                created_utc: post.created_utc
            }));
            allPosts.push(...mapped);
        } catch (err) {
            console.error(`Failed to fetch posts from r/${subreddit}:`, err.message);
            continue;
        }
    }

    return allPosts;
}

module.exports = { fetchRedditPosts };

// --- Add this block to the end of fetchReddit.js ---

async function main() {
    const TARGET_SUBREDDITS = ['deals', 'GameDeals', 'buildapcsales', 'frugal'];
    console.log(`🔍 Fetching posts from: ${TARGET_SUBREDDITS.join(', ')}...`);
    
    const posts = await fetchRedditPosts(TARGET_SUBREDDITS);
    
    console.log(`✅ Fetched ${posts.length} total posts.`);
    
    if (posts.length > 0) {
        console.log('\n--- Sample Post ---');
        console.log(posts[0]);
        console.log('-------------------');
    }
}

// This line ensures the main function is called only when you run the file directly
if (require.main === module) {
    main();
}