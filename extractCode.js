// extractCodes.js

function extractCodes(transcriptLines) {
  const codeRegex = /(?:use\s+code|promo\s+code|coupon\s+code|redeem.*?)\s*[:\-]?\s*([A-Z0-9\-]{5,20})/gi;
  const percentRegex = /\b(\d{1,3})\s*%(\s*off)?\b/gi;
  const flatRegex = /(?:₹|\$)?(\d{2,5})\s*(?:off|discount)/gi;

  const codeSet = new Set();
  const percentSet = new Set();
  const flatSet = new Set();

  for (const line of transcriptLines) {
    let match;

    while ((match = codeRegex.exec(line)) !== null) {
      codeSet.add(match[1]);
    }

    while ((match = percentRegex.exec(line)) !== null) {
      percentSet.add(parseInt(match[1]));
    }

    while ((match = flatRegex.exec(line)) !== null) {
      flatSet.add(parseInt(match[1]));
    }
  }

  return {
    codes: Array.from(codeSet),
    percent_off: Array.from(percentSet),
    flat_discount: Array.from(flatSet),
    confidence: codeSet.size ? 0.9 : 0.5 // boost if code found
  };
}

module.exports = extractCodes;
