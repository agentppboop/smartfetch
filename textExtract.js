// textExtract.js - CORRECTED VERSION

const scoreMatch = require('./scoreMatch');

function extractCodes(text) {
    if (!text || typeof text !== 'string') {
        return {
            links: [],
            codes: [],
            percent_off: [],
            flat_discount: []
        };
    }

    const patterns = {
        links: /https?:\/\/[^\s]+/g,
        useCode: /(?:use|enter|apply)\s+(?:code|promo)[\s:\-]*([A-Z0-9]{3,15})/gi,
        coupon: /coupon[\s:\-]*([A-Z0-9]{3,15})/gi,
        discount: /discount[\s:\-]*([A-Z0-9]{3,15})/gi,
        promo: /promo(?:code)?[\s:\-=]*([A-Z0-9]{3,15})/gi,
        percentOff: /(\d+)%\s*(?:off|discount|savings?)/gi,
        flatDiscount: /(?:\$|₹|rs\.?\s*)(\d+)\s*(?:off|discount|cashback|savings?)/gi,
        alphanum: /\b[A-Z]{2,}[0-9]{2,}|[0-9]{2,}[A-Z]{2,}|[A-Z0-9]{6,12}\b/g
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
            
            if (!['PROMO CODE', 'PROMO CODES', 'COUPON CODE', 'DISCLAIMER'].includes(value.toUpperCase())) {
                if (key === 'links') {
                    results.links.add(value.trim());
                } else if (key === 'percentOff') {
                    results.percent_off.add(parseInt(value));
                } else if (key === 'flatDiscount') {
                    results.flat_discount.add(parseInt(value));
                } else {
                    results.codes.add(value.trim());
                }
            }
        }
    }

    return {
        links: Array.from(results.links),
        codes: Array.from(results.codes),
        percent_off: Array.from(results.percent_off),
        flat_discount: Array.from(results.flat_discount)
    };
}

async function extractFromTranscript(transcriptLines) {
    console.log("\n▶️ Starting extraction pipeline...");
    
    if (!transcriptLines || transcriptLines.length === 0) {
        console.log("⚠️ No transcript lines provided");
        return {
            links: [],
            codes: [],
            percent_off: [],
            flat_discount: [],
            confidence: 0
        };
    }

    const fullText = transcriptLines.join(' ');
    const regexResult = extractCodes(fullText);
    const score = scoreMatch(regexResult);

    if (score >= 0.6) {
        console.log("✅ Regex result accepted (score:", score.toFixed(2) + ")");
        console.log(regexResult);
        return { ...regexResult, confidence: score };
    } else {
        console.log("⚠️ Regex confidence too low (score:", score.toFixed(2) + ")");
        console.log("🧠 Manually test this case on Perplexity:");
        console.log("👉", fullText.substring(0, 200) + "...");
        return { ...regexResult, confidence: score };
    }
}

// Test the function when run directly
if (require.main === module) {
    const testTranscript = [
        "Use code SAVE10 to get 10% off your first order!",
        "This also comes with a ₹200 cashback offer.",
        "Visit https://example.com for more deals."
    ];
    
    extractFromTranscript(testTranscript).then(result => {
        console.log("Test result:", result);
    });
}

module.exports = {
    extractCodes,
    extractFromTranscript
};
