// textExtract.js - ENHANCED VERSION WITH IMPROVED PATTERN RECOGNITION

const scoreMatch = require('./scoreMatch');
const channelRules = require('./channelRules');

// Core blacklist - load from config file for easier maintenance
const coreBlacklist = new Set([
    'CODE', 'CODES', 'PROMO', 'COUPON', 'DISCOUNT', 'BONUS', 'FREE',
    'PROMO CODE', 'PROMO CODES', 'COUPON CODE', 'DISCLAIMER',
    'MRBEAST', 'LINUS', 'MKBHD', 'SUBSCRIBE', 'CHANNEL', 'VIDEO',
    'MERCH', 'EXCLUSIVE', 'CONTENT', 'FLOATPLANE', 'SPONSORS', 'AFFILIATES', 
    'PARTNERS', 'CHAPTERS', 'HERE', 'LINK', '2025', '2024', 
    'DDR5', 'NVME', '16GB', '32GB', 'I7', 'RTX', 'AMD', 'INTEL',
    'NVIDIA', 'GEFORCE', 'RADEON', 'CORSAIR', 'ASUS', 'MSI'
]);

// Tech terms and model numbers to filter out
const techTerms = [
    'DDR5', 'NVME', '16GB', '32GB', 'I7', 'RTX', 'GTX', 'AMD', 'INTEL',
    'NVIDIA', 'GEFORCE', 'RADEON', 'CORSAIR', 'ASUS', 'MSI', 'EVGA',
    'I5', 'I9', 'R5', 'R7', 'R9', 'RTX4090', 'RTX4080', 'RTX4070'
];

// Load blacklist from external config (fallback to core if not available)
function loadBlacklist() {
    try {
        // Try to load from external config file
        const fs = require('fs');
        if (fs.existsSync('./config/blacklist.json')) {
            const externalBlacklist = JSON.parse(fs.readFileSync('./config/blacklist.json', 'utf8'));
            return new Set([...coreBlacklist, ...externalBlacklist.map(term => term.toUpperCase())]);
        }
    } catch (error) {
        console.log('⚠️ Could not load external blacklist, using core blacklist');
    }
    return new Set([...coreBlacklist]);
}

function extractCodes(text, channelId = null) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return {
            links: [],
            codes: [],
            percent_off: [],
            flat_discount: [],
            extractionMetrics: {
                totalMatches: 0,
                filteredOut: 0,
                confidenceBoosts: 0
            }
        };
    }

    // Enhanced patterns with better specificity
    const patterns = {
        links: /https?:\/\/[^\s]+/g,
        
        /* HIGH CONFIDENCE PATTERNS */
        // 1. Codes in quotes (highest confidence)
        quotedCodes: /["']([A-Z0-9]{3,15})["']/g,
        
        // 2. Action-oriented code patterns (high confidence)
        useCode: /(?:use|enter|apply|redeem|type|input)\s+(?:code|promo|coupon)?[\s:\-"']*([A-Z0-9]{3,15})/gi,
        
        // 3. Checkout-specific patterns (high confidence)
        checkoutCode: /(?:at\s+checkout|during\s+checkout|checkout\s+code)[\s:\-"']*([A-Z0-9]{3,15})/gi,
        
        // 4. "With code" patterns (high confidence)
        withCode: /with\s+(?:code|promo)?[\s:\-"']*([A-Z0-9]{3,15})/gi,
        
        /* MEDIUM CONFIDENCE PATTERNS */
        // 5. Coupon variants
        coupon: /coupon[\s:\-]*([A-Z0-9]{3,15})/gi,
        
        // 6. Promo variants  
        promo: /promo(?:code)?[\s:\-=]*([A-Z0-9]{3,15})/gi,
        
        // 7. Code followed by colon or dash
        codePrefix: /code[\s:\-]+([A-Z0-9]{3,15})/gi,
        
        /* DISCOUNT PATTERNS */
        // 8. Enhanced percentage discounts
        percentOff: /(\d+)%\s*(?:off|discount|savings?|reduced|cheaper)/gi,
        
        // 9. Multi-currency flat discounts with decimals
        flatDiscount: /(?:\$|₹|£|€|¥|₩)(\d+(?:\.\d{1,2})?)\s*(?:off|discount|cashback|savings?|reduced)/gi,
        
        // 10. "Get X off" patterns
        getOff: /get\s+(?:\$|₹|£|€)(\d+(?:\.\d{1,2})?)\s*off/gi,
        
        // 11. "Save X" patterns
        saveAmount: /save\s+(?:\$|₹|£|€)(\d+(?:\.\d{1,2})?)/gi,
        
        // 12. Time-based bonuses (extra months, days)
        timeBonus: /(\d+)\s*(?:extra|free|bonus)\s*(?:months?|days?|weeks?)/gi,
        
        // 13. "Up to X%" patterns
        upToPercent: /up\s+to\s+(\d+)%\s*(?:off|discount|savings?)/gi,
        
        /* LOW CONFIDENCE PATTERNS */
        // 14. Restrictive alphanumeric fallback (lowest priority)
        alphanum: /\b(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{4,12}\b/g
    };

    const results = {
        links: new Set(),
        codes: new Set(),
        percent_off: new Set(),
        flat_discount: new Set()
    };

    const metrics = {
        totalMatches: 0,
        filteredOut: 0,
        confidenceBoosts: 0,
        patternMatches: {}
    };

    // Load effective blacklist
    let effectiveBlacklist = loadBlacklist();
    
    // Apply channel-specific blacklist
    if (channelId && channelRules[channelId] && Array.isArray(channelRules[channelId].blacklist)) {
        for (const term of channelRules[channelId].blacklist) {
            effectiveBlacklist.add(term.toUpperCase());
        }
        console.log(`📺 Applied channel-specific rules for: ${channelId}`);
        console.log(`🚫 Total blacklist terms: ${effectiveBlacklist.size}`);
    }

    // Apply custom patterns first if present
    if (channelId && channelRules[channelId] && channelRules[channelId].customPatterns) {
        console.log(`🎯 Applying custom patterns for channel: ${channelId}`);
        for (const [patternName, pattern] of Object.entries(channelRules[channelId].customPatterns)) {
            const customMatches = text.matchAll(pattern);
            for (const match of customMatches) {
                const customCode = match[1] || match[0];
                if (customCode && !effectiveBlacklist.has(customCode.toUpperCase())) {
                    results.codes.add({
                        code: customCode.trim(),
                        confidence: 'high',
                        pattern: `custom_${patternName}`
                    });
                    console.log(`✅ Custom pattern "${patternName}" found: ${customCode}`);
                    metrics.confidenceBoosts++;
                }
            }
        }
    }

    // Process each pattern with confidence scoring
    for (const [key, pattern] of Object.entries(patterns)) {
        const matches = text.matchAll(pattern);
        metrics.patternMatches[key] = 0;
        
        for (const match of matches) {
            const value = match[1] || match[0];
            metrics.totalMatches++;
            metrics.patternMatches[key]++;
            
            if (key === 'links') {
                results.links.add(value.trim());
            } else if (['percentOff', 'upToPercent'].includes(key)) {
                const percentValue = parseInt(value);
                if (percentValue > 0 && percentValue <= 100) {
                    results.percent_off.add(percentValue);
                }
            } else if (['flatDiscount', 'getOff', 'saveAmount'].includes(key)) {
                const discountValue = parseFloat(value);
                if (discountValue > 0 && discountValue <= 10000) { // Reasonable upper limit
                    results.flat_discount.add(discountValue);
                }
            } else if (key === 'timeBonus') {
                const timeValue = parseInt(value);
                if (timeValue > 0 && timeValue <= 365) { // Reasonable limit for days/months
                    results.flat_discount.add(timeValue);
                }
            } else {
                // Handle code extraction with enhanced validation
                const candidate = value.trim().toUpperCase();
                const originalValue = value.trim();
                
                // Enhanced filtering
                if (effectiveBlacklist.has(candidate)) {
                    metrics.filteredOut++;
                    continue;
                }
                
                // Filter out tech terms and specifications
                if (techTerms.some(term => candidate.includes(term))) {
                    metrics.filteredOut++;
                    continue;
                }
                
                // Filter out codes that are just numbers or just letters
                if (/^\d+$/.test(candidate) || /^[A-Z]+$/.test(candidate)) {
                    metrics.filteredOut++;
                    continue;
                }
                
                // Filter out year patterns and model numbers
                if (/^\d{4}$/.test(candidate) || /\d{4}$/.test(candidate)) {
                    metrics.filteredOut++;
                    continue;
                }
                
                // Additional validation for codes
                if (originalValue.length >= 3 && originalValue.length <= 15) {
                    // Assign confidence based on pattern type
                    let confidence = 'low';
                    if (['quotedCodes', 'useCode', 'checkoutCode', 'withCode'].includes(key)) {
                        confidence = 'high';
                        metrics.confidenceBoosts++;
                    } else if (['coupon', 'promo', 'codePrefix'].includes(key)) {
                        confidence = 'medium';
                    }
                    
                    results.codes.add({
                        code: originalValue,
                        confidence: confidence,
                        pattern: key
                    });
                }
            }
        }
    }

    // Convert Sets to Arrays and sort codes by confidence
    const sortedCodes = Array.from(results.codes)
        .sort((a, b) => {
            const confidenceOrder = { high: 3, medium: 2, low: 1 };
            return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
        })
        .map(item => typeof item === 'string' ? item : item.code);

    return {
        links: Array.from(results.links),
        codes: [...new Set(sortedCodes)], // Remove duplicates while preserving order
        percent_off: Array.from(results.percent_off).sort((a, b) => b - a),
        flat_discount: Array.from(results.flat_discount).sort((a, b) => b - a),
        extractionMetrics: metrics
    };
}

async function extractFromTranscript(transcriptLines, channelId = null) {
    console.log("\n▶️ Starting enhanced extraction pipeline...");
    
    if (!transcriptLines || !Array.isArray(transcriptLines) || transcriptLines.length === 0) {
        console.log("⚠️ No valid transcript lines provided");
        return {
            links: [],
            codes: [],
            percent_off: [],
            flat_discount: [],
            confidence: 0,
            extractionMetrics: { totalMatches: 0, filteredOut: 0, confidenceBoosts: 0 }
        };
    }

    // Filter out empty lines and join
    const validLines = transcriptLines.filter(line => line && typeof line === 'string' && line.trim().length > 0);
    
    if (validLines.length === 0) {
        console.log("⚠️ No valid content in transcript lines");
        return {
            links: [],
            codes: [],
            percent_off: [],
            flat_discount: [],
            confidence: 0,
            extractionMetrics: { totalMatches: 0, filteredOut: 0, confidenceBoosts: 0 }
        };
    }

    const fullText = validLines.join(' ');
    console.log(`📝 Processing ${fullText.length} characters from ${validLines.length} lines`);
    
    const regexResult = extractCodes(fullText, channelId);
    console.log("🔍 Enhanced extraction results:", {
        links: regexResult.links.length,
        codes: regexResult.codes.length,
        percent_off: regexResult.percent_off.length,
        flat_discount: regexResult.flat_discount.length,
        metrics: regexResult.extractionMetrics
    });

    let score = 0;
    try {
        score = scoreMatch(regexResult);
        
        // Boost score based on high-confidence patterns
        if (regexResult.extractionMetrics.confidenceBoosts > 0) {
            score += (regexResult.extractionMetrics.confidenceBoosts * 0.1);
            console.log(`🚀 Confidence boost applied: +${regexResult.extractionMetrics.confidenceBoosts * 0.1}`);
        }
        
        score = Math.min(score, 1.0); // Cap at 1.0
    } catch (error) {
        console.log("⚠️ Error calculating score:", error.message);
        score = 0;
    }

    if (score >= 0.6) {
        console.log("✅ Enhanced extraction accepted (score:", score.toFixed(2) + ")");
        console.log("📊 Pattern breakdown:", regexResult.extractionMetrics.patternMatches);
        return { ...regexResult, confidence: score };
    } else {
        console.log("⚠️ Extraction confidence too low (score:", score.toFixed(2) + ")");
        console.log("🔍 Filtered out", regexResult.extractionMetrics.filteredOut, "potential matches");
        console.log("🧠 Manual review recommended:");
        console.log("👉", fullText.substring(0, 200) + (fullText.length > 200 ? "..." : ""));
        return { ...regexResult, confidence: score };
    }
}

// Enhanced testing function
function runEnhancedTests() {
    console.log("\n🧪 Running Enhanced Pattern Tests\n");
    
    const testCases = [
        {
            name: "High Confidence Patterns",
            text: 'Use code "SAVE20" at checkout for 20% off! Apply promo WELCOME10 during checkout.',
            expected: { codes: ['SAVE20', 'WELCOME10'], percent_off: [20] }
        },
        {
            name: "Multi-Currency Discounts",
            text: 'Get $50 off your order! Save ₹200 with this deal. Up to 30% discount available.',
            expected: { flat_discount: [50, 200], percent_off: [30] }
        },
        {
            name: "Time-Based Bonuses",
            text: 'Get 3 extra months free! Bonus 30 days included with purchase.',
            expected: { flat_discount: [3, 30] }
        },
        {
            name: "Tech Terms Filtering",
            text: 'RTX4090 graphics card with DDR5 memory. Use code TECH50 for discount!',
            expected: { codes: ['TECH50'] }
        },
        {
            name: "Blacklist Filtering",
            text: 'Subscribe to our channel! Use PROMO code DISCOUNT123 for savings.',
            expected: { codes: ['DISCOUNT123'] }
        }
    ];
    
    testCases.forEach((testCase, index) => {
        console.log(`\n${index + 1}. ${testCase.name}:`);
        console.log(`Input: "${testCase.text}"`);
        
        const result = extractCodes(testCase.text);
        
        console.log("Results:");
        console.log(`  Codes: [${result.codes.join(', ')}]`);
        console.log(`  Percent Off: [${result.percent_off.join(', ')}]`);
        console.log(`  Flat Discount: [${result.flat_discount.join(', ')}]`);
        console.log(`  Metrics:`, result.extractionMetrics);
        
        // Basic validation
        const hasExpectedCodes = testCase.expected.codes ? 
            testCase.expected.codes.every(code => result.codes.includes(code)) : true;
        const hasExpectedPercent = testCase.expected.percent_off ?
            testCase.expected.percent_off.every(percent => result.percent_off.includes(percent)) : true;
        const hasExpectedDiscount = testCase.expected.flat_discount ?
            testCase.expected.flat_discount.every(discount => result.flat_discount.includes(discount)) : true;
            
        if (hasExpectedCodes && hasExpectedPercent && hasExpectedDiscount) {
            console.log("✅ Test passed!");
        } else {
            console.log("❌ Test failed - check expected vs actual results");
        }
    });
}

// Run tests when executed directly
if (require.main === module) {
    runEnhancedTests();
}

module.exports = {
    extractCodes,
    extractFromTranscript,
    runEnhancedTests
};