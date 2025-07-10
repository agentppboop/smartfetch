// Enhanced scoreMatch.js - YouTube-optimized confidence scoring

function scoreMatch({ 
    codes = [], 
    links = [], 
    percent_off = [], 
    flat_discount = [], 
    codeConfidence = {},
    // NEW: Additional context for YouTube
    rawText = '', 
    videoMetadata = {},
    sponsorBrands = []
} = {}) {
    // Input validation with defensive programming
    if (!Array.isArray(codes)) codes = [];
    if (!Array.isArray(links)) links = [];
    if (!Array.isArray(percent_off)) percent_off = [];
    if (!Array.isArray(flat_discount)) flat_discount = [];
    if (typeof codeConfidence !== 'object' || codeConfidence === null) codeConfidence = {};
    if (typeof rawText !== 'string') rawText = '';
    if (typeof videoMetadata !== 'object' || videoMetadata === null) videoMetadata = {};
    if (!Array.isArray(sponsorBrands)) sponsorBrands = [];

    let score = 0;
    let reasons = [];
    let breakdown = {};

    // 1. PRIMARY CODE SCORING (0.65 max) - Enhanced with YouTube patterns
    if (codes.length > 0) {
        let codeScore = 0;
        
        if (Object.keys(codeConfidence).length > 0) {
            // Enhanced confidence calculation with YouTube context
            const enhancedConfidence = codes.map(code => {
                const baseConfidence = codeConfidence[code] || 0.3;
                const contextBoost = calculateYouTubeContextBoost(code, rawText, sponsorBrands);
                const patternBoost = calculateYouTubePatternBoost(code, videoMetadata);
                
                return Math.min(1.0, baseConfidence + contextBoost + patternBoost);
            });
            
            const maxConfidence = Math.max(...enhancedConfidence);
            const avgConfidence = enhancedConfidence.reduce((sum, conf) => sum + conf, 0) / enhancedConfidence.length;
            
            const weightedConfidence = (maxConfidence * 0.75) + (avgConfidence * 0.25);
            codeScore = weightedConfidence * 0.65;
            
            reasons.push(`Enhanced confidence - Max: ${(maxConfidence * 100).toFixed(0)}%, Avg: ${(avgConfidence * 100).toFixed(0)}%`);
            breakdown.enhancedCodeScore = codeScore;
            
            // YouTube-specific bonuses
            const youtubeBonus = calculateYouTubeBonuses(codes, rawText, videoMetadata);
            codeScore += youtubeBonus;
            breakdown.youtubeBonuses = youtubeBonus;
            
        } else {
            // Enhanced pattern-based scoring for YouTube
            const qualityScores = codes.map(code => assessYouTubeCodeQuality(code, rawText, videoMetadata));
            const avgQuality = qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length;
            
            codeScore = avgQuality * 0.55;
            reasons.push(`YouTube-enhanced pattern quality: ${(avgQuality * 100).toFixed(0)}%`);
            breakdown.youtubePatternScore = codeScore;
            
            // Multiple codes bonus (common in YouTube sponsorships)
            if (codes.length >= 2) {
                const bonus = Math.min(0.1, codes.length * 0.02);
                codeScore += bonus;
                reasons.push(`Multiple codes bonus: +${(bonus * 100).toFixed(1)}%`);
            }
        }
        
        score += Math.min(codeScore, 0.65);
        breakdown.totalCodeScore = Math.min(codeScore, 0.65);
    }

    // 2. SPONSOR CONTEXT SCORING (0.2 max) - YouTube-specific
    let sponsorScore = 0;
    
    if (sponsorBrands.length > 0) {
        // Known sponsor brands increase confidence significantly
        sponsorScore += Math.min(0.15, sponsorBrands.length * 0.05);
        reasons.push(`Known sponsor brands detected: ${sponsorBrands.join(', ')}`);
    }
    
    // Discount information
    if (percent_off.length > 0) {
        const maxDiscount = Math.max(...percent_off);
        const discountWeight = Math.min(1, maxDiscount / 50);
        const discountBonus = Math.min(0.1, 0.1 * discountWeight);
        sponsorScore += discountBonus;
        reasons.push(`Percentage discounts (max ${maxDiscount}%): +${(discountBonus * 100).toFixed(1)}%`);
    }
    
    if (flat_discount.length > 0) {
        sponsorScore += 0.05;
        reasons.push(`Flat discounts: +5%`);
    }
    
    score += Math.min(sponsorScore, 0.2);
    breakdown.sponsorScore = Math.min(sponsorScore, 0.2);

    // 3. LINK QUALITY SCORING (0.1 max) - Reduced, less important for YouTube
    let linkScore = 0;
    if (links.length > 0) {
        const sponsorLinks = links.filter(link => 
            sponsorBrands.some(brand => link.toLowerCase().includes(brand.toLowerCase())) ||
            /\b(deal|discount|promo|coupon|offer|sale|ref=|utm_|aff)/i.test(link)
        );
        
        if (sponsorLinks.length > 0) {
            linkScore += 0.1;
            reasons.push(`Sponsor/promotional links: ${sponsorLinks.length}`);
        } else if (links.length > 0) {
            linkScore += 0.03;
            reasons.push(`Generic links: ${links.length}`);
        }
    }
    
    score += Math.min(linkScore, 0.1);
    breakdown.linkScore = Math.min(linkScore, 0.1);

    // 4. YOUTUBE COHERENCE BONUS (0.15 max) - Enhanced
    let coherenceBonus = 0;
    
    // Strong coherence: codes + discounts + sponsor mention
    if (codes.length > 0 && (percent_off.length > 0 || flat_discount.length > 0) && sponsorBrands.length > 0) {
        coherenceBonus += 0.08;
        reasons.push(`Full promotional coherence: +8%`);
    } else if (codes.length > 0 && (percent_off.length > 0 || flat_discount.length > 0)) {
        coherenceBonus += 0.05;
        reasons.push(`Codes + discounts coherence: +5%`);
    }
    
    // YouTube-specific coherence patterns
    const youtubeCoherence = calculateYouTubeCoherence(codes, rawText, videoMetadata);
    coherenceBonus += youtubeCoherence;
    
    score += Math.min(coherenceBonus, 0.15);
    breakdown.coherenceBonus = Math.min(coherenceBonus, 0.15);

    // 5. ENHANCED QUALITY PENALTIES (-0.2 max)
    let penalties = 0;
    
    if (codes.length > 0) {
        // YouTube-specific suspicious patterns
        const suspiciousPatterns = detectYouTubeSuspiciousPatterns(codes, rawText);
        if (suspiciousPatterns.length > 0) {
            const penalty = Math.min(0.15, suspiciousPatterns.length * 0.05);
            penalties += penalty;
            reasons.push(`YouTube suspicious patterns: -${(penalty * 100).toFixed(1)}% (${suspiciousPatterns.join(', ')})`);
        }
        
        // Generic suspicious codes
        const suspiciousCodes = codes.filter(code => 
            code.length < 4 || code.length > 15 || 
            /^\d+$/.test(code) ||
            /^[A-Z]{1,3}$/.test(code) ||
            code.match(/^(.)\1+$/)
        );
        
        if (suspiciousCodes.length > 0) {
            const penalty = Math.min(0.1, suspiciousCodes.length * 0.03);
            penalties += penalty;
            reasons.push(`Generic suspicious codes: -${(penalty * 100).toFixed(1)}%`);
        }
    }
    
    score -= penalties;
    breakdown.penalties = penalties;

    // Ensure score stays within bounds
    score = Math.max(0, Math.min(score, 1.0));
    breakdown.finalScore = score;
    
    // Enhanced logging
    if (codes.length > 0 || percent_off.length > 0 || flat_discount.length > 0 || sponsorBrands.length > 0) {
        console.log(`🎯 YouTube-Enhanced Scoring (${score.toFixed(3)}):`);
        console.log(`   📊 Breakdown:`, breakdown);
        console.log(`   📝 Reasons:`, reasons);
        
        if (score >= 0.75) {
            console.log(`   ✅ Very high confidence - likely valid YouTube promo`);
        } else if (score >= 0.5) {
            console.log(`   ⚠️ Medium-high confidence - probably valid`);
        } else if (score >= 0.3) {
            console.log(`   ⚠️ Medium confidence - review recommended`);
        } else {
            console.log(`   ❌ Low confidence - likely false positive`);
        }
    }
    
    return score;
}

// YouTube-specific helper functions
function calculateYouTubeContextBoost(code, rawText, sponsorBrands) {
    let boost = 0;
    const lowerText = rawText.toLowerCase();
    const lowerCode = code.toLowerCase();
    
    // Check if code appears near sponsor mentions
    sponsorBrands.forEach(brand => {
        const brandRegex = new RegExp(`\\b${brand.toLowerCase()}\\b.{0,50}\\b${lowerCode}\\b|\\b${lowerCode}\\b.{0,50}\\b${brand.toLowerCase()}\\b`, 'i');
        if (brandRegex.test(lowerText)) {
            boost += 0.15;
        }
    });
    
    // Check for YouTube-specific promotional context
    const youtubePromoPatterns = [
        /\bsponsored by\b/i,
        /\bthanks to.*for sponsoring\b/i,
        /\buse my code\b/i,
        /\bexclusive.*code\b/i,
        /\bspecial offer\b/i,
        /\blink.*description\b/i
    ];
    
    youtubePromoPatterns.forEach(pattern => {
        if (pattern.test(rawText)) {
            boost += 0.05;
        }
    });
    
    return Math.min(boost, 0.3);
}

function calculateYouTubePatternBoost(code, videoMetadata) {
    let boost = 0;
    
    // Channel-specific patterns (if you have channel data)
    if (videoMetadata.channelName) {
        const channelName = videoMetadata.channelName.toLowerCase();
        const codeStart = code.substring(0, 4).toLowerCase();
        
        // Check if code starts with channel name pattern
        if (channelName.includes(codeStart) || codeStart.includes(channelName.substring(0, 4))) {
            boost += 0.1;
        }
    }
    
    // Video category boost (tech channels often have more legit sponsors)
    if (videoMetadata.category === 'Science & Technology' || 
        videoMetadata.category === 'Gaming' ||
        videoMetadata.category === 'Education') {
        boost += 0.05;
    }
    
    return boost;
}

function calculateYouTubeBonuses(codes, rawText, videoMetadata) {
    let bonus = 0;
    
    // Multiple unique sponsor codes (common in longer videos)
    const uniquePrefixes = new Set(codes.map(code => code.substring(0, 3)));
    if (uniquePrefixes.size >= 2) {
        bonus += 0.05;
    }
    
    // High subscriber count channels (if available) tend to have more legitimate sponsors
    if (videoMetadata.subscriberCount > 100000) {
        bonus += 0.03;
    }
    
    return Math.min(bonus, 0.08);
}

function calculateYouTubeCoherence(codes, rawText, videoMetadata) {
    let coherence = 0;
    
    // Check for typical YouTube sponsor segment patterns
    const sponsorSegmentPatterns = [
        /\b(?:but first|before we.*|speaking of|this video.*sponsored)\b/i,
        /\b(?:huge thanks|special thanks|thanks to.*sponsor)\b/i,
        /\b(?:check out|visit|head to|go to).*link.*description\b/i
    ];
    
    sponsorSegmentPatterns.forEach(pattern => {
        if (pattern.test(rawText)) {
            coherence += 0.02;
        }
    });
    
    return Math.min(coherence, 0.07);
}

function detectYouTubeSuspiciousPatterns(codes, rawText) {
    const suspicious = [];
    
    // Too many similar codes (likely spam/fake)
    const codePrefixes = codes.map(code => code.substring(0, 3));
    const uniquePrefixes = new Set(codePrefixes);
    if (codes.length > 3 && uniquePrefixes.size === 1) {
        suspicious.push('duplicate_pattern_spam');
    }
    
    // Codes that don't appear in the text (extraction error)
    codes.forEach(code => {
        if (!rawText.toLowerCase().includes(code.toLowerCase())) {
            suspicious.push(`orphaned_code_${code}`);
        }
    });
    
    return suspicious;
}

// Enhanced YouTube-specific code quality assessment
function assessYouTubeCodeQuality(code, rawText = '', videoMetadata = {}) {
    if (!code || typeof code !== 'string') return 0;
    
    let quality = 0.4; // Slightly lower base for YouTube (more false positives)
    
    // Length quality (YouTube codes tend to be 4-10 chars)
    if (code.length >= 4 && code.length <= 10) {
        quality += 0.25;
    } else if (code.length === 3 || code.length <= 12) {
        quality += 0.1;
    }
    
    // Pattern quality
    const hasNumbers = /\d/.test(code);
    const hasLetters = /[A-Z]/i.test(code);
    
    if (hasNumbers && hasLetters) {
        quality += 0.2;
    } else if (hasNumbers || hasLetters) {
        quality += 0.1;
    }
    
    // YouTube-specific promotional patterns
    const youtubePatterns = [
        /^(SAVE|GET|NEW|FIRST|WELCOME|PROMO|DEAL|OFF)\d+$/i,
        /^[A-Z]{2,6}\d{1,4}$/i, // CreatorName + Numbers
        /^(TECH|GAME|REVIEW|VIDEO)\w+$/i // Category + suffix
    ];
    
    youtubePatterns.forEach(pattern => {
        if (pattern.test(code)) {
            quality += 0.15;
        }
    });
    
    // Context boost - if code appears in rawText near promotional keywords
    if (rawText) {
        const contextRegex = new RegExp(`(?:use|code|promo|discount|save|offer).{0,20}\\b${code}\\b|\\b${code}\\b.{0,20}(?:off|discount|save|deal)`, 'gi');
        if (contextRegex.test(rawText)) {
            quality += 0.1;
        }
    }
    
    // Penalize obvious false positives
    const falsePositives = /^(AND|THE|FOR|YOU|GET|NOW|NEW|ALL|OUT|OFF|BUY|TOP|SEE|USE|TRY|YES|WAY|DAY|TIME|LIKE|JUST|ONLY|MORE|BEST|GOOD|GREAT|VERY|MUCH|WELL|BACK|OVER|HERE|THERE|WHEN|WHERE|WHAT|THIS|THAT|THEY|THEM|WILL|WITH|FROM|HAVE|BEEN|WERE|SAID|EACH|WHICH|THEIR|WOULD|THERE|COULD|OTHER|AFTER|FIRST|NEVER|THESE|THINK|WHERE|BEING|EVERY|GREAT|MIGHT|SHALL|WHILE|THOSE|CAME|RIGHT|STILL|SMALL|LARGE|FOUND|AGAIN|PLACE|SOUND|YEARS|WORLD|BELOW|LATER|OFTEN|ASKED|ORDER|HOUSE|POINT|ROUND|BUILD|MONEY|EARLY|VOICE|WORDS|WATER|WHITE|LIGHT|NIGHT|HEART|POWER|MUSIC|STORY|COURT|PIECE|SPACE|BOARD|TOTAL|BLACK|HUMAN|PARTY|TRADE|STAFF|STYLE|CHIEF|CLASS|PEACE|STATE|STUDY|LEVEL|LOCAL|TODAY|VALUE|WOMAN|UNION|FIELD|SENSE|MARCH|SOUTH|FRONT|THIRD|BREAK|ISSUE|PAPER|PRESS|LEARN|TABLE|PRICE|SERVE|GROUP|SHARE|WHOLE|HORSE|NORTH|CIVIL|ADDED|AHEAD|USUAL|DRIVE|ROUND|HAPPY|FINAL|FORCE|PLAIN|CLEAR|SEVEN|SHALL|SWEET|CHILD|FINAL|PLANT|SOLID|TOUGH|ROUGH|EXACT|PLAIN|BLANK|BROWN|CROWD|DRAWN|FRUIT|BOUND|CHIEF|CLEAN|CLOSE|EXACT|EVERY|FAITH|BASIC|ABOVE|ALIVE|ALONE|ALONG|ANGRY|APART|APART|AWARE|BADLY|BELOW|BRIEF|BROAD|CHEAP|CIVIL|CRAZY|DAILY|DIRTY|EARLY|EMPTY|EQUAL|EXACT|EXTRA|FALSE|FRESH|FULLY|FUNNY|GRAND|GREAT|GREEN|GROSS|HAPPY|HEAVY|HUMAN|IDEAL|INNER|JOINT|KNOWN|LARGE|LATER|LEGAL|LEVEL|LIGHT|LOOSE|LUCKY|MAGIC|MAJOR|MINOR|MIXED|MORAL|NAKED|NASTY|NAVAL|OTHER|OUTER|PLAIN|PRIME|PRIOR|PROUD|QUICK|QUIET|RAPID|READY|RIGHT|ROMAN|ROUGH|ROUND|ROYAL|RURAL|SHARP|SHINY|SHORT|SILLY|SIXTH|SMALL|SMART|SOLID|SORRY|SPARE|SPLIT|STEEP|STILL|SUPER|SWEET|THICK|THIRD|TIGHT|TOTAL|TOUGH|TRULY|TWICE|UNDER|UNDUE|UNION|UPPER|URBAN|USED|USUAL|VALID|VITAL|WHITE|WHOLE|WORTH|WRONG|YOUNG)$/i;
    
    if (falsePositives.test(code)) {
        quality -= 0.4;
    }
    
    // Penalize repeated characters
    if (code.match(/^(.)\1+$/)) {
        quality -= 0.5;
    }
    
    return Math.max(0, Math.min(quality, 1));
}

module.exports = scoreMatch;
module.exports.assessYouTubeCodeQuality = assessYouTubeCodeQuality;