// testExtract.js
const scoreMatch = require('./scoreMatch');

function extractCodes(text) {
  const patterns = {
    links: /https?:\/\/[^\s]+/g,
    alphanum: /\b[A-Z0-9]{5,}\b/g,
    useCode: /use code[:\- ]?([A-Z0-9]+)/gi,
    coupon: /coupon[:\- ]?([A-Z0-9]+)/gi,
    ref: /ref[:\- ]?([A-Z0-9]+)/gi,
    promo: /promo[:\- =]?([A-Z0-9]+)/gi
  };

  const results = {
    links: new Set(),
    codes: new Set()
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[1] || match[0];
      if (!['PROMO CODE', 'PROMO CODES', 'COUPON CODE', 'DISCLAIMER'].includes(value.toUpperCase())) {
        if (key === 'links') results.links.add(value.trim());
        else results.codes.add(value.trim());
      }
    }
  }

  return {
    links: Array.from(results.links),
    codes: Array.from(results.codes)
  };
}

async function extractFromTranscript(transcriptLines) {
  console.log("\n▶️ Starting extraction pipeline...");

  const regexResult = extractCodes(transcriptLines.join(' '));
  const score = scoreMatch(regexResult);

  if (score >= 0.6) {
    console.log("✅ Regex result accepted (score:", score.toFixed(2) + ")");
    console.log(regexResult);
  } else {
    console.log("⚠️ Regex confidence too low (score:", score.toFixed(2) + ")");
    console.log("🧠 Manually test this case on Perplexity:");
    console.log("👉", transcriptLines.join(' '));
  }
}

if (require.main === module) {
  const testTranscript = [
    "Use code SAVE10 to get 10% off your first order!",
    "This also comes with a ₹200 cashback offer.",
    "Visit https://example.com for more deals."
  ];

  extractFromTranscript(testTranscript);
}
