// channelRules.js
module.exports = {
    // Example: Linus Tech Tips
    'UCXuqSBlHAE6Xw-yeJA0Tunw': {
        blacklist: [
            'MERCH', 'EXCLUSIVE', 'CONTENT', 'FLOATPLANE', 'SPONSORS', 'AFFILIATES', 
            'PARTNERS', 'CHAPTERS', 'HERE', 'LINK', 'DDR5', 'NVME', '16GB', '32GB', 
            'I7', 'RTX', '2025', '2024', 'LINUS', 'LTT', 'TECHQUICKIE', 'SHORTCIRCUIT'
        ],
        customPatterns: {
            // Example: Custom code pattern for LTT
            lttCode: /ltt\d{2}/gi,
            // Tech product codes that might be mistaken for promo codes
            techSpecs: /(?:RTX|GTX)\d{4}/gi
        }
    },
    
    // Example: MrBeast Gaming
    'UCIPPMRA040LQr5QPyJEbmXA': {
        blacklist: [
            'MRBEAST', 'GAMING', 'CHALLENGE', 'WINNER', 'BEAST', 'SUBSCRIBE', 
            'NOTIFICATION', 'BELL', 'COMMENT', 'LIKE'
        ],
        customPatterns: {
            // MrBeast specific patterns
            beastCode: /beast\w+/gi
        }
    },
    
    // Example: MKBHD
    'UCBJycsmduvYEL83R_U4JriQ': {
        blacklist: [
            'MKBHD', 'MARQUES', 'BROWNLEE', 'TECH', 'REVIEW', 'CRISP', 'QUALITY',
            'RETRO', 'VINTAGE', 'STUDIO', 'SETUP', 'GEAR'
        ]
    },
    
    // Example: Unbox Therapy
    'UCsTcErHg8oDvUnTzoqsYeNw': {
        blacklist: [
            'UNBOX', 'THERAPY', 'LEWIS', 'HILSENTEGER', 'LATER', 'LEVELS',
            'JACK', 'WILLS', 'VECTOR', 'UNIT'
        ]
    },
    
    // Example: Austin Evans
    'UCXGgrKt94gR6lmN4aN3mYTg': {
        blacklist: [
            'AUSTIN', 'EVANS', 'DUNCAN', 'KINCH', 'THIS', 'GOOD', 'QUESTION',
            'GUYS', 'HERE', 'TODAY'
        ]
    },
    
    // Gaming channels example
    'gaming_channel_example': {
        blacklist: [
            'GAMING', 'GAMEPLAY', 'WALKTHROUGH', 'TUTORIAL', 'GUIDE', 'TIPS',
            'TRICKS', 'CHEATS', 'MODS', 'STREAM', 'LIVE', 'CHAT'
        ],
        customPatterns: {
            gameCode: /game\d+/gi,
            streamCode: /stream\w+/gi
        }
    }
};