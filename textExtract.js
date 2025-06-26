// textExtract.js - ENHANCED WITH DEFENSIVE PROGRAMMING

const scoreMatch = require('./scoreMatch');

// Expanded blacklist for false positives
const BLACKLISTED_CODES = new Set([
    'CODE', 'CODES', 'PROMO', 'COUPON', 'DISCOUNT', 'BONUS', 'FREE',
    'PROMO CODE', 'PROMO CODES', 'COUPON CODE', 'DISCLAIMER',
    'SAVE', 'GET', 'USE', 'APPLY', 'ENTER', 'TYPE', 'CLAIM',
    // Common false positives from YouTube
    'SUBSCRIBE', 'LIKE', 'COMMENT', 'SHARE', 'FOLLOW', 'JOIN',
    'LUCK', 'SYSTEM', 'VIDEO', 'CHANNEL', 'CONTENT', 'WATCH',
    'CLICK', 'CHECK', 'MORE', 'INFO', 'HELP', 'SUPPORT',
    'MUSIC', 'AUDIO', 'SOUND', 'INTRO', 'OUTRO', 'SPONSOR',
    // Generic patterns
    'HTTP', 'HTTPS', 'WWW', 'COM', 'ORG', 'NET',
    // Social media
    'INSTAGRAM', 'TWITTER', 'FACEBOOK', 'TIKTOK', 'DISCORD',
    'YOUTUBE', 'REDDIT', 'LINKEDIN', 'SNAPCHAT'
]);

// Generic/boilerplate link patterns to filter out
const GENERIC_LINK_PATTERNS = [
    /mrbeast\.store/i,
    /discord\.gg/i,
    /youtube\.com\/channel/i,
    /youtube\.com\/@/i,
    /instagram\.com\/[^/]*\/?$/i,
    /twitter\.com\/[^/]*\/?$/i,
    /facebook\.com\/[^/]*\/?$/i,
    /tiktok\.com\/@[^/]*\/?$/i,
    /linkedin\.com\/in\/[^/]*\/?$/i,
    /patreon\.com\/[^/]*\/?$/i,
    /twitch\.tv\/[^/]*\/?$/i,
    // Generic social media patterns
    /\/join\/?$/i,
    /\/subscribe\/?$/i,
    /\/follow\/?$/i
];

// Enhanced link filtering
function isGenericLink(url) {
    if (!url || typeof url !== 'string') return true;
    
    // Check against known generic patterns
    return GENERIC_LINK_PATTERNS.some(pattern => pattern.test(url));
}

// Enhanced code validation with defensive checks
function isValidCode(code) {
    // Defensive null/undefined check
    if (!code || typeof code !== 'string') return false;
    
    const trimmedCode = code.trim().toUpperCase();
    
    // Length check
    if (trimmedCode.length < 3 || trimmedCode.length > 12) return false;
    
    // Blacklist check
    if (BLACKLISTED_CODES.has(trimmedCode)) return false;
    
    // Pattern-based filtering
    if (/^\d+$/.test(trimmedCode)) return false; // Only numbers
    if (/^[A-Z]{1,2}$/.test(trimmedCode)) return false; // Too short/generic
    if (trimmedCode.includes('HTTP')) return false; // URL fragments
    if (/^[A-Z]+$/.test(trimmedCode) && trimmedCode.length <= 4) return false; // Short all-letter codes
    
    // Additional quality checks
    if (!/[A-Z]/.test(trimmedCode) && !/\d/.test(trimmedCode)) return false; // Must have letters or numbers
    if (trimmedCode.match(/^(.)\1+$/)) return false; // Repeated characters (AAA, 111)
    
    return true;
}

function extractCodes(text) {
    // Defensive input validation
    if (!text || typeof text !== 'string') {
        console.log("⚠️ Invalid text input for extraction");
        return {
            links: [],
            codes: [],
            codeConfidence: {},
            percent_off: [],
            flat_discount: []
        };
    }

    const cleanText = text.trim();
    if (cleanText.length === 0) {
        console.log("⚠️ Empty text input for extraction");
        return {
            links: [],
            codes: [],
            codeConfidence: {},
            percent_off: [],
            flat_discount: []
        };
    }

    const patterns = {
        links: /https?:\/\/[^\s\)]+/g,
        
        // High-confidence patterns (more specific context)
        highConfidenceCodes: {
            // "Use code SAVE20 for..." or "Enter WELCOME15 at..."
            actionable: /(?:use|enter|apply|redeem|type|input)\s+(?:code|promo|coupon)?[\s:\-"']*([A-Z0-9]{3,12})\b/gi,
            
            // "Code: SAVE20" or "Promo: WELCOME15"
            labeled: /(?:code|promo|coupon|discount)[\s:\-=]+([A-Z0-9]{3,12})\b/gi,
            
            // Quoted codes "SAVE20" or 'WELCOME15'
            quoted: /["']([A-Z0-9]{4,10})["']/g,
            
            // Checkout context: "checkout with SAVE20"
            checkout: /checkout[\s\w]*(?:with|using|code)[\s:\-]*([A-Z0-9]{3,12})\b/gi,
        },
        
        // Medium-confidence patterns
        mediumConfidenceCodes: {
            // Get/Save patterns: "get SAVE20" or "save with WELCOME15"
            getSave: /(?:get|save|grab|claim)[\s\w]{0,10}([A-Z0-9]{4,10})\b/gi,
            
            // Percentage tied to code: "SAVE20 for 20% off"
            percentTied: /([A-Z0-9]{4,10})\s+(?:for|gives?|gets?)[\s\w]*\d+%/gi,
            
            // Legacy coupon/promo patterns
            coupon: /coupon[\s:\-]*([A-Z0-9]{3,15})/gi,
            promo: /promo(?:code)?[\s:\-=]*([A-Z0-9]{3,15})/gi,
        },
        
        // Low-confidence fallback (restrictive)
        lowConfidenceCodes: {
            // Only strong alphanumeric patterns in promotional contexts
            contextual: /(?:discount|deal|offer|save|promo|special)[\s\w]{0,20}([A-Z0-9]{4,10})\b/gi,
            
            // Standalone alphanumeric (very restrictive)
            standalone: /\b(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{5,10}\b(?!\d)/g
        },
        
        // Discount patterns
        percentOff: /(\d+)%\s*(?:off|discount|savings?)/gi,
        flatDiscount: /(?:\$|₹|£|€)(\d+(?:\.\d{1,2})?)\s*(?:off|discount|cashback|savings?)/gi
    };

    const results = {
        links: new Set(),
        codes: new Map(), // Map to track confidence levels
        percent_off: new Set(),
        flat_discount: new Set()
    };

    // Confidence levels
    const confidenceLevels = {
        high: 0.9,
        medium: 0.6,
        low: 0.3
    };

    try {
        // Extract links with defensive handling
        const linkMatches = cleanText.matchAll(patterns.links);
        for (const match of linkMatches) {
            try {
                const link = match[0]?.trim();
                if (link && !isGenericLink(link)) {
                    results.links.add(link);
                }
            } catch (err) {
                console.log("⚠️ Error processing link match:", err.message);
            }
        }

        // High confidence patterns
        for (const [patternName, pattern] of Object.entries(patterns.highConfidenceCodes)) {
            try {
                const matches = cleanText.matchAll(pattern);
                for (const match of matches) {
                    try {
                        const code = match[1]?.trim()?.toUpperCase();
                        if (code && isValidCode(code)) {
                            const currentConf = results.codes.get(code) || 0;
                            results.codes.set(code, Math.max(currentConf, confidenceLevels.high));
                        }
                    } catch (err) {
                        console.log("⚠️ Error processing high confidence code:", err.message);
                    }
                }
            } catch (err) {
                console.log(`⚠️ Error with high confidence pattern ${patternName}:`, err.message);
            }
        }

        // Medium confidence patterns
        for (const [patternName, pattern] of Object.entries(patterns.mediumConfidenceCodes)) {
            try {
                const matches = cleanText.matchAll(pattern);
                for (const match of matches) {
                    try {
                        const code = match[1]?.trim()?.toUpperCase();
                        if (code && isValidCode(code) && !results.codes.has(code)) {
                            results.codes.set(code, confidenceLevels.medium);
                        }
                    } catch (err) {
                        console.log("⚠️ Error processing medium confidence code:", err.message);
                    }
                }
            } catch (err) {
                console.log(`⚠️ Error with medium confidence pattern ${patternName}:`, err.message);
            }
        }

        // Low confidence patterns (only if we haven't found many codes yet)
        if (results.codes.size < 2) {
            for (const [patternName, pattern] of Object.entries(patterns.lowConfidenceCodes)) {
                try {
                    const matches = cleanText.matchAll(pattern);
                    for (const match of matches) {
                        try {
                            const code = match[1]?.trim()?.toUpperCase();
                            if (code && isValidCode(code) && !results.codes.has(code)) {
                                results.codes.set(code, confidenceLevels.low);
                            }
                        } catch (err) {
                            console.log("⚠️ Error processing low confidence code:", err.message);
                        }
                    }
                } catch (err) {
                    console.log(`⚠️ Error with low confidence pattern ${patternName}:`, err.message);
                }
            }
        }

        // Extract discounts with defensive handling
        try {
            const percentMatches = cleanText.matchAll(patterns.percentOff);
            for (const match of percentMatches) {
                try {
                    const percent = parseInt(match[1]);
                    if (!isNaN(percent) && percent > 0 && percent <= 100) {
                        results.percent_off.add(percent);
                    }
                } catch (err) {
                    console.log("⚠️ Error processing percent discount:", err.message);
                }
            }
        } catch (err) {
            console.log("⚠️ Error extracting percent discounts:", err.message);
        }

        try {
            const flatMatches = cleanText.matchAll(patterns.flatDiscount);
            for (const match of flatMatches) {
                try {
                    const amount = parseFloat(match[1]);
                    if (!isNaN(amount) && amount > 0) {
                        results.flat_discount.add(amount);
                    }
                } catch (err) {
                    console.log("⚠️ Error processing flat discount:", err.message);
                }
            }
        } catch (err) {
            console.log("⚠️ Error extracting flat discounts:", err.message);
        }

    } catch (error) {
        console.log("⚠️ Critical error in extractCodes:", error.message);
        return {
            links: [],
            codes: [],
            codeConfidence: {},
            percent_off: [],
            flat_discount: []
        };
    }

    return {
        links: Array.from(results.links),
        codes: Array.from(results.codes.keys()),
        codeConfidence: Object.fromEntries(results.codes),
        percent_off: Array.from(results.percent_off).sort((a, b) => b - a),
        flat_discount: Array.from(results.flat_discount).sort((a, b) => b - a)
    };
}

async function extractFromTranscript(transcriptLines) {
    console.log("\n▶️ Starting extraction pipeline...");
    
    // Defensive validation of input
    if (!transcriptLines) {
        console.log("⚠️ No transcript lines provided (null/undefined)");
        return {
            links: [],
            codes: [],
            codeConfidence: {},
            percent_off: [],
            flat_discount: [],
            confidence: 0
        };
    }

    if (!Array.isArray(transcriptLines)) {
        console.log("⚠️ Transcript lines is not an array, attempting to convert");
        // Attempt to handle single string input
        if (typeof transcriptLines === 'string') {
            transcriptLines = [transcriptLines];
        } else {
            console.log("⚠️ Cannot convert transcript lines to array");
            return {
                links: [],
                codes: [],
                codeConfidence: {},
                percent_off: [],
                flat_discount: [],
                confidence: 0
            };
        }
    }

    if (transcriptLines.length === 0) {
        console.log("⚠️ Empty transcript lines array");
        return {
            links: [],
            codes: [],
            codeConfidence: {},
            percent_off: [],
            flat_discount: [],
            confidence: 0
        };
    }

    // Filter out invalid lines with defensive checks
    const validLines = transcriptLines.filter(line => {
        if (!line) return false;
        if (typeof line !== 'string') return false;
        if (line.trim().length === 0) return false;
        return true;
    });
    
    if (validLines.length === 0) {
        console.log("⚠️ No valid content in transcript lines after filtering");
        return {
            links: [],
            codes: [],
            codeConfidence: {},
            percent_off: [],
            flat_discount: [],
            confidence: 0
        };
    }

    let fullText;
    try {
        fullText = validLines.join(' ').trim();
    } catch (error) {
        console.log("⚠️ Error joining transcript lines:", error.message);
        return {
            links: [],
            codes: [],
            codeConfidence: {},
            percent_off: [],
            flat_discount: [],
            confidence: 0
        };
    }

    if (!fullText || fullText.length === 0) {
        console.log("⚠️ Empty full text after joining");
        return {
            links: [],
            codes: [],
            codeConfidence: {},
            percent_off: [],
            flat_discount: [],
            confidence: 0
        };
    }

    console.log(`📝 Processing ${fullText.length} characters from ${validLines.length} lines`);
    
    let regexResult;
    try {
        regexResult = extractCodes(fullText);
    } catch (error) {
        console.log("⚠️ Error in extractCodes:", error.message);
        return {
            links: [],
            codes: [],
            codeConfidence: {},
            percent_off: [],
            flat_discount: [],
            confidence: 0
        };
    }

    console.log("🔍 Regex extraction results:", {
        links: regexResult.links?.length || 0,
        codes: regexResult.codes?.length || 0,
        percent_off: regexResult.percent_off?.length || 0,
        flat_discount: regexResult.flat_discount?.length || 0
    });

    // Show individual code confidences
    if (regexResult.codeConfidence && Object.keys(regexResult.codeConfidence).length > 0) {
        console.log("🎯 Code confidence levels:");
        for (const [code, confidence] of Object.entries(regexResult.codeConfidence)) {
            console.log(`   ${code}: ${(confidence * 100).toFixed(0)}%`);
        }
    }

    let score = 0;
    try {
        score = scoreMatch(regexResult);
    } catch (error) {
        console.log("⚠️ Error calculating score:", error.message);
        score = 0;
    }

    // Adjusted threshold for better capture rate
    const threshold = 0.4; // Lowered from 0.5 for more permissive capture
    
    if (score >= threshold) {
        console.log(`✅ Result accepted (score: ${score.toFixed(2)} >= ${threshold})`);
        console.log("📊 Final results:", {
            codes: regexResult.codes || [],
            links: regexResult.links?.length || 0,
            discounts: (regexResult.percent_off?.length || 0) + (regexResult.flat_discount?.length || 0)
        });
        return { ...regexResult, confidence: score };
    } else {
        console.log(`⚠️ Low confidence (score: ${score.toFixed(2)} < ${threshold})`);
        if (score >= 0.2) {
            console.log("📋 Flagged for manual review:");
            console.log("   Codes found:", regexResult.codes || []);
            console.log("   Sample text:", fullText.substring(0, 200) + (fullText.length > 200 ? "..." : ""));
        }
        return { ...regexResult, confidence: score };
    }
}

module.exports = {
    extractCodes,
    extractFromTranscript,
    isValidCode,
    isGenericLink,
    BLACKLISTED_CODES,
    GENERIC_LINK_PATTERNS
};