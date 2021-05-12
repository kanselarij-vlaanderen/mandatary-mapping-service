import { getSimilarity, getDistance, getWeightedScore, normalizeString } from '../similarity/similarity';

// thresholds used to consider a candidate mandatary a match
const SIMILARITY_THRESHOLDS = {
  name: 0.4,
  familyName: 0.4,
  firstName: 0,
  titel: 0.4
};

// Finds the best match for a Kaleidos mandatary in the specified searchSet (ideally: a government composition as known in Themis).
// thresholds can be set per compared property, as their similarity scales differ vastly. (a single threshold is too naive)
const findThemisMandataris = function (mandataris, searchSet, thresholds, enableLogging) {
  if (!thresholds) {
    thresholds = SIMILARITY_THRESHOLDS;
  }
  for (const key in SIMILARITY_THRESHOLDS) {
    if (SIMILARITY_THRESHOLDS.hasOwnProperty(key) && thresholds[key] === undefined) {
      thresholds[key] = SIMILARITY_THRESHOLDS[key];
    }
  }
  // first get a set of preliminary matches
  let possibleMatches = []; // for debugging/provenance purposes
  if (mandataris && searchSet) {
    // console.log(JSON.stringify(mandataris));
    // console.log('============');
    for (const themisMandataris of searchSet) {
      themisMandataris.scores = {};
      // themisMandataris.distances = {};
      // compare full name, first name, and family name
      if (mandataris.name) {
        mandataris.normalizedName = normalizeString(mandataris.name, 'name');
        themisMandataris.normalizedName = normalizeString(themisMandataris.voornaam + ' ' + themisMandataris.familienaam, 'name');
        let similarity = getSimilarity(mandataris.name, themisMandataris.voornaam + ' ' + themisMandataris.familienaam, 'name');
        themisMandataris.scores.name = similarity;
        // themisMandataris.distances.name = getDistance(mandataris.name, themisMandataris.voornaam + ' ' + themisMandataris.familienaam, 'name');
      }
      if (mandataris.familyName) {
        mandataris.normalizedFamilyName = normalizeString(mandataris.familyName, 'name');
        themisMandataris.normalizedFamilyName = normalizeString(themisMandataris.familienaam, 'name');
        let similarity = getSimilarity(mandataris.familyName, themisMandataris.familienaam, 'name');
        themisMandataris.scores.familyName = similarity;
        // themisMandataris.distances.familyName = getDistance(mandataris.familyName, themisMandataris.familienaam, 'name');
      }

      if (mandataris.firstName) {
        mandataris.normalizedFirstName = normalizeString(mandataris.firstName);
        themisMandataris.normalizedFirstName = normalizeString(themisMandataris.voornaam);
        let similarity = getSimilarity(mandataris.firstName, themisMandataris.voornaam);
        themisMandataris.scores.firstName = similarity;
        // themisMandataris.distances.firstName = getDistance(mandataris.firstName, themisMandataris.voornaam, 'name');
      }
      // if the titel is set, it MUST match above the threshold
      if (mandataris.titel) {// check if 'minister-president' or 'voorzitter' occur in the title, but not 'vice'
        let similarity = 0;
        if (themisMandataris.bestuursfunctieLabel.toLowerCase() === 'minister-president') {
          if (mandataris.titel.toLowerCase().indexOf('vice') === -1 && (mandataris.titel.toLowerCase().indexOf('president') > -1 )) {
            similarity = 1;
          } else if (mandataris.titel.toLowerCase().indexOf('vice') === -1 && (mandataris.titel.toLowerCase().indexOf('voorzitter') > -1 )) {
            similarity = 0.1; // in the early days, they often used 'voorzitter' instead of minister-president
          }
        } else if (themisMandataris.bestuursfunctieLabel.toLowerCase() === 'viceminister-president') {
          if (mandataris.titel.toLowerCase().indexOf('vice') > -1) {
            similarity = 1;
          }
        } else if (themisMandataris.titel) {
          // compare the whole title
          mandataris.normalizedTitel = normalizeString(mandataris.titel, 'title');
          themisMandataris.normalizedTitel = normalizeString(themisMandataris.titel, 'title');
          similarity = getSimilarity(mandataris.titel, themisMandataris.titel, 'title');
          // themisMandataris.distances.titel = getDistance(mandataris.titel, themisMandataris.titel, 'title');
        }
        themisMandataris.scores.titel = similarity;
      }
      // some properties are required to have at least some similarity, such as the name or familyName. Otherwise we get nonsense matches based on title or first name alone.
      // if both are below the threshold, but the title has a good score, we can include the match, as this likely means there was no name set in Kaleidos
      if (themisMandataris.scores.name > SIMILARITY_THRESHOLDS.name || themisMandataris.scores.familyName > SIMILARITY_THRESHOLDS.familyName || themisMandataris.scores.titel > SIMILARITY_THRESHOLDS.titel) {
        themisMandataris.score = getWeightedScore(themisMandataris.scores);
      } else {
        themisMandataris.score = 0;
      }
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
    if (searchSet[0].score > 0) {
      return { score: searchSet[0].score, ...searchSet[0]};
    }
  } else {
    // console.log(`No match found for ${mandataris.name ? mandataris.name : '(no name)'} (${mandataris.firstName ? mandataris.firstName : '(no firstName)'} ${mandataris.familyName ? mandataris.familyName : '(no familyName)'})`);
    // console.log('******************');
    return;
  }
};

export { SIMILARITY_THRESHOLDS, findThemisMandataris };
