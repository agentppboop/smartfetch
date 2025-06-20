// nlpFallback.js - COMPLETE CORRECTED VERSION

const { OpenAI } = require("openai");
require("dotenv").config();

if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️ OPENAI_API_KEY not found. NLP fallback will be disabled.");
}

const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
});

async function nlpFallback(text) {
    if (!process.env.OPENAI_API_KEY) {
        console.log("⚠️ OpenAI API key not available, skipping NLP fallback");
        return {
            codes: [],
            percent_off: [],
            flat_discount: [],
            confidence: 0
        };
    }

    if (!text || typeof text !== 'string') {
        console.error("⚠️ Invalid input text provided");
        return {
            codes: [],
            percent_off: [],
            flat_discount: [],
            confidence: 0
        };
    }

    const prompt = `
Extract any promo codes or discounts from this text: "${text}"

Return this JSON format:
{
    "codes": ["string"],
    "percent_off": [number],
    "flat_discount": [number],
    "confidence": 0.0
}`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            max_tokens: 200
        });

        if (!completion.choices || completion.choices.length === 0) {
            throw new Error("No response from OpenAI API");
        }

        const result = JSON.parse(completion.choices[0].message.content);
        
        // Validate the response structure
        return {
            codes: Array.isArray(result.codes) ? result.codes : [],
            percent_off: Array.isArray(result.percent_off) ? result.percent_off : [],
            flat_discount: Array.isArray(result.flat_discount) ? result.flat_discount : [],
            confidence: typeof result.confidence === 'number' ? result.confidence : 0
        };

    } catch (e) {
        console.error("⚠️ NLP Fallback error:", e.message);
        return {
            codes: [],
            percent_off: [],
            flat_discount: [],
            confidence: 0
        };
    }
} // ← ADD THIS MISSING CLOSING BRACE

module.exports = nlpFallback;
