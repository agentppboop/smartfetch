// nlpFallback.js
const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function nlpFallback(text) {
  const prompt = `
Extract any promo code or discount from this text: "${text}"

Return this JSON:
{
  "codes": [string],
  "percent_off": [number],
  "flat_discount": [number],
  "confidence": float
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // change to model: "gpt-4", if bought later


    messages: [{ role: "user", content: prompt }],
  });

  try {
    return JSON.parse(completion.choices[0].message.content);
  } catch (e) {
    console.error("⚠️ GPT JSON parse error");
    return null;
  }
}

module.exports = nlpFallback;

// 🔬 TEST
if (require.main === module) {
  const testText = "Click now and enjoy a surprise 30% discount — no code required!";
  nlpFallback(testText).then(console.log);
}