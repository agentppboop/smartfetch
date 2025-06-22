// textExtract.js - CORRECTED VERSION

const scoreMatch = require('./scoreMatch');

const blacklist = new Set([
    'CODE', 'CODES', 'PROMO', 'COUPON', 'DISCOUNT', 'BONUS', 'FREE',
    'PROMO CODE', 'PROMO CODES', 'COUPON CODE', 'DISCLAIMER'
]);

function extractCodes(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return {
            links: [],
            codes: [],
            percent_off: [],
            flat_discount: []
        };
    }

    const patterns = {
        links: /https?:\/\/[^\s]+/g,
        
        /* New: Quoted codes */
        quotedCodes: /["']([A-Z0-9]{3,15})["']/g,
        
        /* Improved: Actionable code keywords */
        useCode: /(?:use|enter|apply|redeem)\s+(?:code|promo|coupon)[\s:\-"']*([A-Z0-9]{3,15})/gi,
        
        /* Existing: coupon/promotional variants */
        coupon: /coupon[\s:\-]*([A-Z0-9]{3,15})/gi,
        promo: /promo(?:code)?[\s:\-=]*([A-Z0-9]{3,15})/gi,
        
        /* Percentage discounts */
        percentOff: /(\d+)%\s*(?:off|discount|savings?)/gi,
        
        /* Flat discounts with decimals and multiple currencies */
        flatDiscount: /(?:\$|₹|£|€)(\d+(?:\.\d{1,2})?)\s*(?:off|discount|cashback|savings?)/gi,
        
        /* Restrictive alphanumeric fallback - improved pattern */
        alphanum: /\b(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{4,12}\b/g
    };

    const results = {
        links: new Set(),
        codes: new Set(),
        percent_off: new Set(),
        flat_discount: new Set()
    };

    for (const [key, pattern] of Object.entries(patterns)) {
        const matches = text.matchAll(pattern);
        
        for (const match of matches) {
            const value = match[1] || match[0];
            
            if (key === 'links') {
                results.links.add(value.trim());
            } else if (key === 'percentOff') {
                const percentValue = parseInt(value);
                if (percentValue > 0 && percentValue <= 100) {
                    results.percent_off.add(percentValue);
                }
            } else if (key === 'flatDiscount') {
                const discountValue = parseFloat(value);
                if (discountValue > 0) {
                    results.flat_discount.add(discountValue);
                }
            } else {
                // Handle code extraction with blacklist filtering
                const candidate = value.trim().toUpperCase();
                const originalValue = value.trim();
                
                // Skip if it's in the blacklist
                if (blacklist.has(candidate)) {
                    continue;
                }
                
                // Additional validation for codes
                if (originalValue.length >= 3 && originalValue.length <= 15) {
                    results.codes.add(originalValue);
                }
            }
        }
    }

    return {
        links: Array.from(results.links),
        codes: Array.from(results.codes),
        percent_off: Array.from(results.percent_off).sort((a, b) => b - a), // Sort descending
        flat_discount: Array.from(results.flat_discount).sort((a, b) => b - a) // Sort descending
    };
}

async function extractFromTranscript(transcriptLines) {
    console.log("\n▶️ Starting extraction pipeline...");
    
    if (!transcriptLines || !Array.isArray(transcriptLines) || transcriptLines.length === 0) {
        console.log("⚠️ No valid transcript lines provided");
        return {
            links: [],
            codes: [],
            percent_off: [],
            flat_discount: [],
            confidence: 0
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
            confidence: 0
        };
    }

    const fullText = validLines.join(' ');
    console.log(`📝 Processing ${fullText.length} characters from ${validLines.length} lines`);
    
    const regexResult = extractCodes(fullText);
    console.log("🔍 Regex extraction results:", {
        links: regexResult.links.length,
        codes: regexResult.codes.length,
        percent_off: regexResult.percent_off.length,
        flat_discount: regexResult.flat_discount.length
    });

    let score = 0;
    try {
        score = scoreMatch(regexResult);
    } catch (error) {
        console.log("⚠️ Error calculating score:", error.message);
        score = 0;
    }

    if (score >= 0.6) {
        console.log("✅ Regex result accepted (score:", score.toFixed(2) + ")");
        console.log("📊 Results:", regexResult);
        return { ...regexResult, confidence: score };
    } else {
        console.log("⚠️ Regex confidence too low (score:", score.toFixed(2) + ")");
        console.log("🧠 Manually test this case on Perplexity:");
        console.log("👉", fullText.substring(0, 200) + (fullText.length > 200 ? "..." : ""));
        return { ...regexResult, confidence: score };
    }
}

// Test the function when run directly
if (require.main === module) {
    const testTranscript = [
        "Use code SAVE10 to get 10% off your first order!",
        "This also comes with a ₹200 cashback offer.",
        "Visit https://example.com for more deals.",
        "Don't forget to apply WELCOME15 at checkout.",
        "Get 25% discount with PROMO25!"
    ];
    
    extractFromTranscript(testTranscript).then(result => {
        console.log("\n🧪 Test result:");
        console.log("Links:", result.links);
        console.log("Codes:", result.codes);
        console.log("Percent off:", result.percent_off);
        console.log("Flat discount:", result.flat_discount);
        console.log("Confidence:", result.confidence);
    }).catch(error => {
        console.error("❌ Test failed:", error);
    });
}

module.exports = {
    extractCodes,
    extractFromTranscript
};