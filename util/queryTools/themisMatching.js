import { getSimilarity, getWeightedScore } from '../similarity/similarity';

// thresholds used to consider a candidate mandatary a match
const SIMILARITY_THRESHOLDS = {
  name: 0.2,
  familyName: 0.2,
  firstName: 0,
  start: 0,
  titel: 0
};

// Finds the best match for a Kaleidos mandatary in the specified searchSet (ideally: a government composition as known in Themis).
// thresholds can be set per compared property, as their similarity scales differ vastly. (a single threshold is too naive)
const findThemisMandataris = function (mandataris, searchSet, thresholds, enableLogging) {
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
      themisMandataris.scores = {};
      // compare full name, first name, and family name
      if (mandataris.name) {
        let similarity = getSimilarity(mandataris.name, themisMandataris.voornaam + ' ' + themisMandataris.familienaam);
        if (similarity >= thresholds.name) {
          themisMandataris.scores.name = similarity;
        }
      }
      if (mandataris.familyName) {
        let similarity = getSimilarity(mandataris.familyName, themisMandataris.familienaam);
        if (similarity >= thresholds.familyName) {
          themisMandataris.scores.familyName = similarity;
        }
      }

      if (mandataris.firstName) {
        let similarity = getSimilarity(mandataris.firstName, themisMandataris.voornaam);
        if (similarity >= thresholds.firstName) {
          themisMandataris.scores.firstName = similarity;
        }
      }
      // if the titel is set, it MUST match above the threshold
      if (mandataris.titel) {// check if 'minister-president' or 'voorzitter' occur in the title, but not 'vice'
        let similarity = 0;
        if (themisMandataris.bestuursfunctieLabel.toLowerCase() === 'minister-president') {
          if (mandataris.titel.toLowerCase().indexOf('vice') === -1 && (mandataris.titel.toLowerCase().indexOf('president') > -1 )) {
            similarity = 1;
          }
        } else if (themisMandataris.bestuursfunctieLabel.toLowerCase() === 'viceminister-president') {
          if (mandataris.titel.toLowerCase().indexOf('vice') > -1) {
            similarity = 1;
          }
        } else if (themisMandataris.titel) {
          // compare the whole title
          similarity = getSimilarity(mandataris.titel, themisMandataris.titel);
        }
        if (similarity >= thresholds.titel) {
          themisMandataris.scores.titel = similarity;
        }
      }
      themisMandataris.score = getWeightedScore(themisMandataris.scores);
    }
  }

  if (searchSet.length > 0) {
    // now we need to rank the results and return the best one.
    searchSet.sort((a, b) => {
      return b.score - a.score;
    });
    if (enableLogging) {
      console.log('--------');
      console.log('Matching scores for: ');
      console.log(mandataris.name + ' ; ' + mandataris.firstName + ' ; ' + mandataris.familyName + ' ; ' + mandataris.titel);
    }
    // console.log(`Possible Matches for ${mandataris.name ? mandataris.name : '(no name)'} (${mandataris.firstName ? mandataris.firstName : '(no firstName)'} ${mandataris.familyName ? mandataris.familyName : '(no familyName)'})`);
    for (const themisMandataris of searchSet) {
      if (enableLogging) {
        console.log('--');
        console.log(themisMandataris.voornaam + ' ' + themisMandataris.familienaam + ' ; ' + themisMandataris.bestuursfunctieLabel + ' ; ' + themisMandataris.titel);
        console.log(JSON.stringify(themisMandataris.scores));
        console.log(themisMandataris.score);
      }
      // console.log('' + possibleMatch.voornaam + ' ' + possibleMatch.familienaam + ' (score ' + possibleMatch.score + ')');
      // console.log('Scores: ' + JSON.stringify(possibleMatch.scores, null, ' '));
      // console.log('--------------');
    }
    return { score: searchSet[0].score, ...searchSet[0]};
  } else {
    // console.log(`No match found for ${mandataris.name ? mandataris.name : '(no name)'} (${mandataris.firstName ? mandataris.firstName : '(no firstName)'} ${mandataris.familyName ? mandataris.familyName : '(no familyName)'})`);
    // console.log('******************');
    return;
  }
};

export { SIMILARITY_THRESHOLDS, findThemisMandataris };
