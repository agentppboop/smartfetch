// testConnections.js - Test your Reddit and Google Sheets connections
require('dotenv').config();
const { fetchRedditPosts } = require('./fetchReddit.js');
const { testConnection: testGoogleSheets } = require('./syncToSheet.js');

async function testRedditConnection() {
    console.log('🧪 Testing Reddit API connection...');
    
    try {
        // Test with a single, reliable subreddit
        const posts = await fetchRedditPosts(['deals']);
        
        if (posts.length > 0) {
            console.log(`✅ Reddit connection successful! Fetched ${posts.length} posts.`);
            console.log('\n📋 Sample post:');
            console.log(`Title: ${posts[0].title.substring(0, 80)}...`);
            console.log(`Subreddit: r/${posts[0].subreddit}`);
            console.log(`Score: ${posts[0].upvotes} upvotes`);
            console.log(`URL: ${posts[0].url}`);
            return true;
        } else {
            console.log('⚠️ Reddit connection works but no posts returned');
            return false;
        }
    } catch (error) {
        console.error('❌ Reddit connection failed:', error.message);
        
        if (error.message.includes('CLIENT_ID')) {
            console.error('💡 Check your REDDIT_CLIENT_ID environment variable');
        } else if (error.message.includes('CLIENT_SECRET')) {
            console.error('💡 Check your REDDIT_CLIENT_SECRET environment variable');
        } else if (error.message.includes('REFRESH_TOKEN')) {
            console.error('💡 Check your REDDIT_REFRESH_TOKEN environment variable');
        } else if (error.message.includes('401')) {
            console.error('💡 Authentication failed - check all Reddit credentials');
        }
        
        return false;
    }
}

async function testEnvironmentVariables() {
    console.log('🔧 Checking environment variables...');
    
    const requiredVars = [
        'REDDIT_CLIENT_ID',
        'REDDIT_CLIENT_SECRET', 
        'REDDIT_REFRESH_TOKEN',
        'GOOGLE_SHEET_ID',
        'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        'GOOGLE_PRIVATE_KEY'
    ];
    
    const missing = [];
    const present = [];
    
    for (const varName of requiredVars) {
        if (process.env[varName]) {
            present.push(varName);
        } else {
            missing.push(varName);
        }
    }
    
    console.log(`✅ Present (${present.length}): ${present.join(', ')}`);
    
    if (missing.length > 0) {
        console.log(`❌ Missing (${missing.length}): ${missing.join(', ')}`);
        return false;
    }
    
    // Check Google Private Key formatting
    if (process.env.GOOGLE_PRIVATE_KEY && !process.env.GOOGLE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
        console.log('⚠️ GOOGLE_PRIVATE_KEY might be incorrectly formatted');
    }
    
    return true;
}

async function runAllTests() {
    console.log('🚀 Running connection tests for SmartFetch MVP...\n');
    
    let allPassed = true;
    
    // Test 1: Environment Variables
    const envTest = await testEnvironmentVariables();
    allPassed = allPassed && envTest;
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Reddit API
    const redditTest = await testRedditConnection();
    allPassed = allPassed && redditTest;
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Google Sheets API
    const sheetsTest = await testGoogleSheets();
    allPassed = allPassed && sheetsTest;
    
    console.log('\n' + '='.repeat(50));
    
    // Summary
    if (allPassed) {
        console.log('\n🎉 All tests passed! Your SmartFetch MVP is ready to run.');
        console.log('💡 Next step: Run `node runMvp.js` to start the full pipeline');
    } else {
        console.log('\n❌ Some tests failed. Please fix the issues above before running the pipeline.');
        console.log('\n🔧 Troubleshooting tips:');
        console.log('1. Check your .env file exists and has all required variables');
        console.log('2. Verify Reddit app credentials at https://www.reddit.com/prefs/apps');
        console.log('3. Ensure Google service account has access to your sheet');
        console.log('4. Test individual components with `node fetchReddit.js` or `node syncToSheet.js`');
    }
    
    return allPassed;
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = {
    testRedditConnection,
    testGoogleSheets,
    testEnvironmentVariables,
    runAllTests
};