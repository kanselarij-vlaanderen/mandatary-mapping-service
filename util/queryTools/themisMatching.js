import { getSimilarity, getWeightedScore } from '../similarity/similarity';

// thresholds used to consider a candidate mandatary a match
const SIMILARITY_THRESHOLDS = {
  name: 0.3,
  familyName: 0.3,
  firstName: 0.3,
  start: 0.001,
  titel: 0.1
};

// Finds the best match for a Kaleidos mandatary in the specified searchSet (ideally: a government composition as known in Themis).
// thresholds can be set per compared property, as their similarity scales differ vastly. (a single threshold is too naive)
const findThemisMandataris = function (mandataris, searchSet, thresholds) {
  if (!thresholds) {
    thresholds = SIMILARITY_THRESHOLDS;
  }
  if (thresholds.name === undefined) {
    thresholds.name = 0.5;
  }
  if (thresholds.firstName === undefined) {
    thresholds.firstName = 0.5;
  }
  if (thresholds.familyName === undefined) {
    thresholds.familyName = 0.5;
  }
  if (thresholds.start === undefined) {
    thresholds.start = 0.03;
  }
  if (thresholds.titel === undefined) {
    thresholds.titel = 0.25;
  }
  // first get a set of preliminary matches
  let possibleMatches = []; // for debugging/provenance purposes
  if (mandataris && searchSet) {
    // console.log(JSON.stringify(mandataris));
    // console.log('============');
    for (const themisMandataris of searchSet) {
      let scores = {};
      let compared = []; // for debugging/provenance purposes
      // compare full name, first name, and family name
      if (mandataris.name) {
        let similarity = getSimilarity(mandataris.name, themisMandataris.voornaam + ' ' + themisMandataris.familienaam);
        scores.name = similarity;
      }
      if (mandataris.familyName) {
        let similarity = getSimilarity(mandataris.familyName, themisMandataris.familienaam);
        scores.familyName = similarity;
      }
      let preliminaryMatch = false; // check if any of the scores were calculated
      for (const key in scores) {
        if (scores.hasOwnProperty(key) && thresholds.hasOwnProperty(key)) {
          // as soon as either the name OR the family name matches, we consider it a preliminary match
          if (scores[key] >= thresholds[key]) {
            preliminaryMatch = true;
          }
        }
      }

      // titles and firstNames are too unreliable to contribute to the score on their own (e.g., titles will always contain similar terms such as 'minister', and thus will never be 0)
      // However, they can be tie-breakers when we have multiple preliminary matched mandataries with the same or a similar name

      // if the firstName is set, it MUST match above the threshold
      if (preliminaryMatch && mandataris.firstName) {
        let similarity = getSimilarity(mandataris.firstName, themisMandataris.voornaam);
        if (similarity >= thresholds.firstName) {
          scores.firstName = similarity;
        } else {
          preliminaryMatch = false; // stop here
        }
      }
      // if the titel is set, it MUST match above the threshold
      if (preliminaryMatch && mandataris.titel) {// check if 'minister-president' or 'voorzitter' occur in the title, but not 'vice'
        if (themisMandataris.bestuursfunctieLabel === 'Minister-president') {
          let similarity = 0;
          if (mandataris.titel.toLowerCase().indexOf('vice') === -1 && (mandataris.titel.toLowerCase().indexOf('president') > -1 )) {
            similarity = 1;
          }
          if (similarity === 1) {
            scores.titel = similarity;
          } else {
            preliminaryMatch = false;// stop here
          }
        } else if (themisMandataris.bestuursfunctieLabel === 'Viceminister-president') {
          let similarity = 0;
          if (mandataris.titel.toLowerCase().indexOf('vice') > -1) {
            similarity = 1;
          }
          if (similarity === 1) {
            scores.titel = similarity;
          } else {
            preliminaryMatch = false;// stop here
          }
        } else if (themisMandataris.titel) {
          // compare the whole title
          let similarity = getSimilarity(mandataris.titel, themisMandataris.titel);
          if (similarity >= thresholds.start) {
            scores.titel = similarity;
          } else {
            preliminaryMatch = false;// stop here
          }
        }
      }
      // if everything checks out, add this to the possible matches
      if (preliminaryMatch) {
        possibleMatches.push({ score: getWeightedScore(scores), scores: scores, ...themisMandataris });
      }
    }
  }

  // now we need to rank the results and return the best one.
  possibleMatches.sort((a, b) => {
    let scoreA = getWeightedScore(a);
    let scoreB = getWeightedScore(a);
    return scoreA - scoreB;
  });
  if (possibleMatches.length > 0) {
    // console.log(`Possible Matches for ${mandataris.name ? mandataris.name : '(no name)'} (${mandataris.firstName ? mandataris.firstName : '(no firstName)'} ${mandataris.familyName ? mandataris.familyName : '(no familyName)'})`);
    for (const possibleMatch of possibleMatches) {
      // console.log('' + possibleMatch.voornaam + ' ' + possibleMatch.familienaam + ' (score ' + possibleMatch.score + ')');
      // console.log('Scores: ' + JSON.stringify(possibleMatch.scores, null, ' '));
      // console.log('--------------');
    }
  }
  if (possibleMatches.length > 0) {
    return { score: getWeightedScore(possibleMatches[0]), ...possibleMatches[0]};
  } else {
    // console.log(`No match found for ${mandataris.name ? mandataris.name : '(no name)'} (${mandataris.firstName ? mandataris.firstName : '(no firstName)'} ${mandataris.familyName ? mandataris.familyName : '(no familyName)'})`);
    // console.log('******************');
    return;
  }
};

export { findThemisMandataris };
