import { distance } from 'fastest-levenshtein';

// weighting used for all similarities in the final ranking of candidate matches. Total must equal 1
const SIMILARITY_WEIGHTS = {
  name: 0.3,
  familyName: 0.2,
  firstName: 0.2,
  start: 0.1,
  titel: 0.2
};

// calculates similarity between two strings based on their edit distance
const getSimilarity = function (a, b) {
  let d = distance(a.toLowerCase(), b.toLowerCase());
  let similarity = d === 0 ? 1 : (1.0 / d);
  return similarity;
};

// used to rank candidate matches
const getWeightedScore = function (scores) {
  let score = 0;
  for (const key in SIMILARITY_WEIGHTS) {
    if (SIMILARITY_WEIGHTS.hasOwnProperty(key)) {
      if (scores.hasOwnProperty(key)) {
        score += SIMILARITY_WEIGHTS[key] * scores[key];
      } else {
        score += SIMILARITY_WEIGHTS[key]; // when not scored, assign the full weight
      }
    }
  }
  return score;
};

export { getSimilarity, getWeightedScore };
