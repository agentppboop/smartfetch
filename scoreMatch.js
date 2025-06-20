// scoreMatch.js
function scoreMatch({ codes, percent_off, flat_discount, confidence = 0 }) {
  let score = 0;

  if (codes.length) score += 0.4;
  if (percent_off.length || flat_discount.length) score += 0.3;
  score += confidence * 0.3;

  return Math.min(score, 1.0);
}

module.exports = scoreMatch;
