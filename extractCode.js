// extractCodes.js

function extractCodes(transcriptLines) {
  const contextRegex = /(?:use\s+code|promo\s+code|coupon\s+code|redeem.*?)\s*[:\-]?\s*([A-Z0-9\-]{5,20})/gi;
  const codeSet = new Set();

  for (const line of transcriptLines) {
    let match;
    while ((match = contextRegex.exec(line)) !== null) {
      codeSet.add(match[1]);
    }
  }

  return Array.from(codeSet);
}

module.exports = extractCodes;
