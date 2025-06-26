// retryFailed.js - Script to retry failed AI requests

const { EnhancedAIPostProcessor, FailureTracker } = require('./aiPostProcessor');

class FailedRequestRetrier {
    constructor(config = {}) {
        this.processor = new EnhancedAIPostProcessor(config);
        this.failureTracker = new FailureTracker(config.failureFile);
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 2000;
    }

    async retryAll(options = {}) {
        const {
            maxAge = 24 * 60 * 60 * 1000, // 24 hours
            skipRecentFailures = true,
            onlyVideoIds = null,
            dryRun = false
        } = options;

        console.log('🔄 Loading failed requests...');
        const failures = await this.failureTracker.getFailures();
        
        if (failures.length === 0) {
            console.log('✅ No failed requests to retry');
            return { total: 0, retried: 0, successful: 0, failed: 0 };
        }

        // Filter failures based on criteria
        let filteredFailures = failures.filter(failure => {
            // Skip already resolved
            if (failure.resolved) return false;
            
            // Skip if exceeded max retries
            if ((failure.retryCount || 0) >= this.maxRetries) return false;
            
            // Skip recent failures if requested
            if (skipRecentFailures && failure.lastRetry) {
                const lastRetryTime = new Date(failure.lastRetry).getTime();
                if (Date.now() - lastRetryTime < this.retryDelay) return false;
            }
            
            // Skip old failures
            const failureTime = new Date(failure.timestamp).getTime();
            if (Date.now() - failureTime > maxAge) return false;
            
            // Filter by specific video IDs if provided
            if (onlyVideoIds && !onlyVideoIds.includes(failure.videoId)) return false;
            
            return true;
        });

        console.log(`📊 Found ${failures.length} total failures, ${filteredFailures.length} eligible for retry`);
        
        if (filteredFailures.length === 0) {
            console.log('ℹ️ No failures meet retry criteria');
            return { total: failures.length, retried: 0, successful: 0, failed: 0 };
        }

        if (dryRun) {
            console.log('🔍 DRY RUN - Would retry:');
            filteredFailures.forEach(failure => {
                console.log(`  - ${failure.videoId} (failed: ${failure.timestamp}, retries: ${failure.retryCount || 0})`);
            });
            return { total: failures.length, retried: filteredFailures.length, successful: 0, failed: 0, dryRun: true };
        }

        let successful = 0;
        let failed = 0;

        console.log(`🚀 Starting retry process for ${filteredFailures.length} requests...`);

        for (const [index, failure] of filteredFailures.entries()) {
            console.log(`\n[${index + 1}/${filteredFailures.length}] Retrying ${failure.videoId}...`);
            
            try {
                // Mark as being retried
                await this.failureTracker.markRetried(failure.videoId, false);
                
                // Attempt the AI request again
                const responseText = await this.processor.queue.add(
                    () => this.processor.makeOpenAIRequest(failure.prompt),
                    { videoId: failure.videoId, prompt: failure.prompt, isRetry: true }
                );

                const aiResult = this.processor.parseAIResponse(responseText);
                
                if (aiResult) {
                    console.log(`✅ Retry successful for ${failure.videoId} (confidence: ${aiResult.confidence.toFixed(2)})`);
                    await this.failureTracker.markRetried(failure.videoId, true);
                    successful++;
                    
                    // Optionally save the successful result
                    if (options.saveResults) {
                        await this.saveRetryResult(failure.videoId, aiResult, failure);
                    }
                } else {
                    throw new Error('Failed to parse AI response on retry');
                }
                
            } catch (error) {
                console.log(`❌ Retry failed for ${failure.videoId}: ${error.message}`);
                failed++;
                
                // Log the new failure
                await this.failureTracker.logFailure(
                    failure.videoId,
                    failure.prompt,
                    error,
                    { ...failure.metadata, isRetry: true, originalFailure: failure.timestamp }
                );
            }
            
            // Small delay between retries
            if (index < filteredFailures.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`\n📊 Retry Summary:`);
        console.log(`   Total failures: ${failures.length}`);
        console.log(`   Attempted retries: ${filteredFailures.length}`);
        console.log(`   Successful: ${successful}`);
        console.log(`   Failed: ${failed}`);
        console.log(`   Success rate: ${((successful / filteredFailures.length) * 100).toFixed(1)}%`);

        return {
            total: failures.length,
            retried: filteredFailures.length,
            successful,
            failed
        };
    }

    async saveRetryResult(videoId, aiResult, originalFailure) {
        try {
            const resultsFile = 'retry-results.json';
            let results = [];
            
            try {
                const fs = require('fs').promises;
                const data = await fs.readFile(resultsFile, 'utf8');
                results = JSON.parse(data);
            } catch (err) {
                // File doesn't exist, start fresh
            }

            results.push({
                videoId,
                aiResult,
                originalFailure: originalFailure.timestamp,
                retriedAt: new Date().toISOString(),
                retryCount: originalFailure.retryCount || 0
            });

            const fs = require('fs').promises;
            await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
        } catch (error) {
            console.log(`⚠️ Failed to save retry result for ${videoId}:`, error.message);
        }
    }

    async getRetryStats() {
        const failures = await this.failureTracker.getFailures();
        
        const stats = {
            total: failures.length,
            resolved: failures.filter(f => f.resolved).length,
            unresolved: failures.filter(f => !f.resolved).length,
            maxRetries: failures.filter(f => (f.retryCount || 0) >= this.maxRetries).length,
            byError: {}
        };

        // Group by error type
        failures.forEach(failure => {
            const errorType = failure.error.split(':')[0] || 'Unknown';
            stats.byError[errorType] = (stats.byError[errorType] || 0) + 1;
        });

        return stats;
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const retrier = new FailedRequestRetrier({
        apiKey: process.env.OPENAI_API_KEY,
        failureFile: 'failed-ai-requests.json',
        requestsPerMinute: 15 // More conservative for retries
    });

    switch (command) {
        case 'retry':
            const dryRun = args.includes('--dry-run');
            const maxAge = args.includes('--max-age') ? 
                parseInt(args[args.indexOf('--max-age') + 1]) * 60 * 60 * 1000 : 
                24 * 60 * 60 * 1000;
            
            await retrier.retryAll({ 
                dryRun, 
                maxAge,
                saveResults: !dryRun 
            });
            break;

        case 'stats':
            const stats = await retrier.getRetryStats();
            console.log('\n📊 Failure Statistics:');
            console.log(`   Total failures: ${stats.total}`);
            console.log(`   Resolved: ${stats.resolved}`);
            console.log(`   Unresolved: ${stats.unresolved}`);
            console.log(`   Max retries exceeded: ${stats.maxRetries}`);
            console.log('\n   By error type:');
            Object.entries(stats.byError).forEach(([error, count]) => {
                console.log(`     ${error}: ${count}`);
            });
            break;

        case 'clean':
            await retrier.failureTracker.clearResolved();
            break;

        default:
            console.log(`
Usage: node retryFailed.js <command> [options]

Commands:
  retry [--dry-run] [--max-age HOURS]  Retry failed requests
  stats                                Show failure statistics  
  clean                                Remove resolved failures

Examples:
  node retryFailed.js retry --dry-run          # Preview what would be retried
  node retryFailed.js retry --max-age 48       # Only retry failures from last 48 hours
  node retryFailed.js retry                    # Actually retry failures
  node retryFailed.js stats                    # Show failure statistics
  node retryFailed.js clean                    # Clean up resolved failures
            `);
    }
}

// Export for use as module
module.exports = { FailedRequestRetrier };

// Run CLI if called directly
if (require.main === module) {
    main().catch(console.error);
}