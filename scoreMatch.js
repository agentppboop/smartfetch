// scoreMatch.js - CORRECTED VERSION

function scoreMatch({ codes = [], percent_off = [], flat_discount = [], confidence = 0 } = {}) {
    // Input validation to prevent TypeError
    if (!Array.isArray(codes)) codes = [];
    if (!Array.isArray(percent_off)) percent_off = [];
    if (!Array.isArray(flat_discount)) flat_discount = [];
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
        confidence = 0;
    }

    let score = 0;
if (codes.length > 0) score += 0.5;      // Stronger for code presence
if (percent_off.length || flat_discount.length) score += 0.3;
score += confidence * 0.2;               // Reduced reliance on confidence
return Math.min(score, 1.0);


    // Award points for having codes
    if (codes.length > 0) {
        score += 0.4;
    }

    // Award points for having discounts
    if (percent_off.length > 0 || flat_discount.length > 0) {
        score += 0.3;
    }

    // Add confidence score (weighted)
    score += confidence * 0.3;

    // Ensure score doesn't exceed 1.0
    return Math.min(score, 1.0);
}

module.exports = scoreMatch;
