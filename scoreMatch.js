// scoreMatch.js - ENHANCED CONFIDENCE SCORING

function scoreMatch({ codes = [], links = [], percent_off = [], flat_discount = [], codeConfidence = {} } = {}) {
    // Input validation with defensive programming
    if (!Array.isArray(codes)) codes = [];
    if (!Array.isArray(links)) links = [];
    if (!Array.isArray(percent_off)) percent_off = [];
    if (!Array.isArray(flat_discount)) flat_discount = [];
    if (typeof codeConfidence !== 'object' || codeConfidence === null) codeConfidence = {};

    let score = 0;
    let reasons = []; // For debugging
    let breakdown = {}; // Detailed scoring breakdown

    // 1. Primary Code Scoring (0.7 max) - Increased weight
    if (codes.length > 0) {
        let codeScore = 0;
        
        // Use individual code confidence if available (preferred method)
        if (Object.keys(codeConfidence).length > 0) {
            const confidenceValues = codes.map(code => codeConfidence[code] || 0.3);
            const maxConfidence = Math.max(...confidenceValues);
            const avgConfidence = confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length;
            
            // Weight towards the highest confidence code, but consider average
            const weightedConfidence = (maxConfidence * 0.7) + (avgConfidence * 0.3);
            codeScore = weightedConfidence * 0.7;
            
            reasons.push(`Code confidence - Max: ${(maxConfidence * 100).toFixed(0)}%, Avg: ${(avgConfidence * 100).toFixed(0)}%`);
            breakdown.codeConfidenceScore = codeScore;
            
            // Bonus for multiple high-confidence codes
            const highConfCodes = codes.filter(code => codeConfidence[code] >= 0.8);
            if (highConfCodes.length >= 2) {
                const bonus = Math.min(0.1, highConfCodes.length * 0.03);
                codeScore += bonus;
                reasons.push(`Multiple high-confidence codes bonus: +${(bonus * 100).toFixed(1)}%`);
            }
            
        } else {
            // Fallback to pattern-based scoring
            codeScore = 0.4; // Base score for having codes
            
            // Quality assessment based on code patterns
            const qualityScores = codes.map(code => assessCodeQuality(code));
            const avgQuality = qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length;
            
            codeScore = avgQuality * 0.6;
            reasons.push(`Pattern-based code quality: ${(avgQuality * 100).toFixed(0)}%`);
            breakdown.patternBasedScore = codeScore;
            
            // Multiple codes bonus
            if (codes.length >= 2) {
                const bonus = Math.min(0.1, codes.length * 0.025);
                codeScore += bonus;
                reasons.push(`Multiple codes bonus: +${(bonus * 100).toFixed(1)}%`);
            }
        }
        
        score += Math.min(codeScore, 0.7);
        breakdown.totalCodeScore = Math.min(codeScore, 0.7);
    }

    // 2. Promotional Context Scoring (0.2 max) - Rebalanced
    let contextScore = 0;
    
    // Discount information strongly suggests promotional content
    if (percent_off.length > 0) {
        // Higher discounts get more weight
        const maxDiscount = Math.max(...percent_off);
        const discountWeight = Math.min(1, maxDiscount / 50); // 50% discount = full weight
        contextScore += 0.12 * discountWeight;
        reasons.push(`Percentage discounts (max ${maxDiscount}%): +${(0.12 * discountWeight * 100).toFixed(1)}%`);
    }
    
    if (flat_discount.length > 0) {
        // Flat discounts are also strong indicators
        contextScore += 0.08;
        reasons.push(`Flat discounts: +8%`);
    }
    
    score += Math.min(contextScore, 0.2);
    breakdown.contextScore = Math.min(contextScore, 0.2);

    // 3. Link Quality Scoring (0.15 max) - Enhanced
    let linkScore = 0;
    if (links.length > 0) {
        // Classify links by quality
        const promotionalLinks = links.filter(link => 
            /\b(deal|discount|promo|coupon|offer|sale|affiliate|ref=|utm_|code=)\b/i.test(link)
        );
        
        const commercialLinks = links.filter(link =>
            /\b(shop|store|buy|order|checkout|cart|product)\b/i.test(link) ||
            /\.(com|store|shop)/.test(link)
        );
        
        if (promotionalLinks.length > 0) {
            linkScore += 0.15;
            reasons.push(`Promotional links found: ${promotionalLinks.length}`);
        } else if (commercialLinks.length > 0) {
            linkScore += 0.08;
            reasons.push(`Commercial links found: ${commercialLinks.length}`);
        } else if (links.length > 0) {
            linkScore += 0.04;
            reasons.push(`Generic links found: ${links.length}`);
        }
    }
    
    score += Math.min(linkScore, 0.15);
    breakdown.linkScore = Math.min(linkScore, 0.15);

    // 4. Coherence Bonus (0.1 max) - New scoring dimension
    let coherenceBonus = 0;
    
    // Bonus for having both codes AND discounts (strong promotional signal)
    if (codes.length > 0 && (percent_off.length > 0 || flat_discount.length > 0)) {
        coherenceBonus += 0.05;
        reasons.push(`Codes + discounts coherence: +5%`);
    }
    
    // Bonus for having codes AND promotional links
    if (codes.length > 0 && links.some(link => 
        /\b(deal|discount|promo|coupon|offer|sale|shop|store)\b/i.test(link))) {
        coherenceBonus += 0.05;
        reasons.push(`Codes + promotional links coherence: +5%`);
    }
    
    score += Math.min(coherenceBonus, 0.1);
    breakdown.coherenceBonus = Math.min(coherenceBonus, 0.1);

    // 5. Quality Penalties (-0.15 max)
    let penalties = 0;
    
    if (codes.length > 0) {
        // Penalty for suspicious codes
        const suspiciousCodes = codes.filter(code => 
            code.length < 4 || code.length > 10 || 
            /^\d+$/.test(code) || // Just numbers
            /^[A-Z]{1,3}$/.test(code) || // Too short/generic
            code.match(/^(.)\1+$/) // Repeated characters
        );
        
        if (suspiciousCodes.length > 0) {
            const penalty = Math.min(0.1, suspiciousCodes.length * 0.03);
            penalties += penalty;
            reasons.push(`Suspicious codes penalty: -${(penalty * 100).toFixed(1)}% (${suspiciousCodes.join(', ')})`);
        }
        
        // Penalty for too many codes (likely spam)
        if (codes.length > 5) {
            const penalty = Math.min(0.05, (codes.length - 5) * 0.01);
            penalties += penalty;
            reasons.push(`Too many codes penalty: -${(penalty * 100).toFixed(1)}%`);
        }
    }
    
    score -= penalties;
    breakdown.penalties = penalties;

    // Ensure score stays within bounds
    score = Math.max(0, Math.min(score, 1.0));
    breakdown.finalScore = score;
    
    // Enhanced logging for debugging
    if (codes.length > 0 || percent_off.length > 0 || flat_discount.length > 0 || links.length > 0) {
        console.log(`🎯 Scoring breakdown (${score.toFixed(3)}):`);
        console.log(`   📊 Breakdown:`, breakdown);
        console.log(`   📝 Reasons:`, reasons);
        
        // Quality assessment
        if (score >= 0.7) {
            console.log(`   ✅ High confidence result`);
        } else if (score >= 0.4) {
            console.log(`   ⚠️ Medium confidence - review recommended`);
        } else {
            console.log(`   ❌ Low confidence - likely false positive`);
        }
    }
    
    return score;
}

// Helper function to assess individual code quality
function assessCodeQuality(code) {
    if (!code || typeof code !== 'string') return 0;
    
    let quality = 0.5; // Base quality
    
    // Length quality (sweet spot is 4-8 characters)
    if (code.length >= 4 && code.length <= 8) {
        quality += 0.2;
    } else if (code.length === 3 || code.length === 9) {
        quality += 0.1;
    }
    
    // Pattern quality
    const hasNumbers = /\d/.test(code);
    const hasLetters = /[A-Z]/.test(code);
    
    if (hasNumbers && hasLetters) {
        quality += 0.2; // Mixed alphanumeric is good
    } else if (hasNumbers || hasLetters) {
        quality += 0.1; // Single type is okay
    }
    
    // Common promotional patterns
    if (/^(SAVE|GET|NEW|FIRST|WELCOME|PROMO|DEAL)\d+$/i.test(code)) {
        quality += 0.1;
    }
    
    // Avoid obviously generic patterns
    if (/^(TEST|DEMO|EXAMPLE|SAMPLE)\d*$/i.test(code)) {
        quality -= 0.3;
    }
    
    // Avoid repeated characters
    if (code.match(/^(.)\1+$/)) {
        quality -= 0.4;
    }
    
    return Math.max(0, Math.min(quality, 1));
}

// Export both functions for testing
module.exports = scoreMatch;
module.exports.assessCodeQuality = assessCodeQuality;