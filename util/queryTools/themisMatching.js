import { getSimilarity, getDistance, getWeightedScore, normalizeString } from '../similarity/similarity';
import { isOutlier } from './outliers';
// thresholds used to consider a candidate mandatary a match
const SIMILARITY_THRESHOLDS = {
  name: 0.5,
  familyName: 0.5,
  firstName: 0,
  titel: 0.5
};

// to clean up the logs a bit
let previousLogMessage = '';

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
  let possibleMatches = [];
  let falseMatches = []; // for debugging/provenance purposes
  if (mandataris && searchSet) {
    // console.log(JSON.stringify(mandataris));
    // console.log('============');

    if (mandataris.name) {
      mandataris.normalizedName = normalizeString(mandataris.name, 'name');
    }
    if (mandataris.familyName) {
      mandataris.normalizedFamilyName = normalizeString(mandataris.familyName, 'name');
    }
    if (mandataris.firstName) {
      mandataris.normalizedFirstName = normalizeString(mandataris.firstName);
    }
    if (mandataris.titel) {
      mandataris.normalizedTitel = normalizeString(mandataris.titel, 'title');
    }
    // some mandataries are not part of a Flemish government, so we'll never find a match for them (and we don't need to)
    let skip = isOutlier(mandataris);
    if (skip) {
      if (enableLogging) {
        let logMessage = `WARNING: skipping non-Flemish-government mandatary ${mandataris.name} : ${mandataris.titel} (one '.' for every additional agendapoint)`;
        if (previousLogMessage === logMessage) {
          process.stdout.write('.');
        } else {
          previousLogMessage = logMessage;
          console.log('');
          console.log(logMessage);
        }
      }
    } else {
      for (const originalThemisMandataris of searchSet) {
        let themisMandataris = { ...originalThemisMandataris };
        themisMandataris.scores = {};
        // themisMandataris.distances = {};
        // compare full name, first name, and family name
        if (mandataris.name) {
          let similarity = getSimilarity(mandataris.name, themisMandataris.voornaam + ' ' + themisMandataris.familienaam, 'name');
          themisMandataris.scores.name = similarity;
          // themisMandataris.distances.name = getDistance(mandataris.name, themisMandataris.voornaam + ' ' + themisMandataris.familienaam, 'name');
        }
        if (mandataris.familyName) {
          let similarity = getSimilarity(mandataris.familyName, themisMandataris.familienaam, 'name');
          themisMandataris.scores.familyName = similarity;
          // themisMandataris.distances.familyName = getDistance(mandataris.familyName, themisMandataris.familienaam, 'name');
        }

        if (mandataris.firstName) {
          let similarity = getSimilarity(mandataris.firstName, themisMandataris.voornaam);
          themisMandataris.scores.firstName = similarity;
          // themisMandataris.distances.firstName = getDistance(mandataris.firstName, themisMandataris.voornaam, 'name');
        }
        // if the titel is set, it MUST match above the threshold
        if (mandataris.titel) {// check if 'minister-president' occurs in the title, but not 'vice'
          let similarity = 0;
          if (themisMandataris.bestuursfunctieLabel.toLowerCase() === 'minister-president') {
            if (mandataris.normalizedTitel.indexOf('vice') === -1 && (mandataris.normalizedTitel.indexOf('president') > -1 )) {
              similarity = 1;
            }
          } else if (themisMandataris.bestuursfunctieLabel.toLowerCase() === 'viceminister-president') {
            if (mandataris.normalizedTitel.indexOf('vice') > -1) {
              similarity = 1;
            }
          } else if (themisMandataris.titel) {
            // compare the whole title
            similarity = getSimilarity(mandataris.titel, themisMandataris.titel, 'title');
            // themisMandataris.distances.titel = getDistance(mandataris.titel, themisMandataris.titel, 'title');
          }
          themisMandataris.scores.titel = similarity;
        }
        // Some properties are required to have at least some similarity, such as the name or familyName. Otherwise we get nonsense matches based on title or first name alone.
        // However, if for example only the title is set and it has a good score, we can include the match, as this likely means there was no name set in Kaleidos.
        // Similarly, if only the name/familyName match, but the title match is low, it could mean there's just not much difference in the name, such as 'Coens' and 'Geens', which only have a string distance of 2.
        if (themisMandataris.scores.name > 0 || themisMandataris.scores.familyName > 0) {
          // the names can only be used for a match if the title is above the threshold, or not set at all
          if (themisMandataris.scores.name >= thresholds.name || themisMandataris.scores.familyName >= thresholds.familyName) {
            if (themisMandataris.scores.titel > 0) {
              if (themisMandataris.scores.titel >= thresholds.titel) {
                themisMandataris.score = getWeightedScore(themisMandataris.scores);
              } else if (themisMandataris.scores.name === 1 || themisMandataris.scores.familyName === 1) {
                // handle the edge case where the name is a perfect match, but the title is below the threshold
                // lowering the title threshold would give false matches, but this doesn't
                themisMandataris.score = getWeightedScore(themisMandataris.scores);
              }
            } else if (themisMandataris.scores.name === 1 || themisMandataris.scores.familyName === 1 || (themisMandataris.scores.name >= thresholds.name && themisMandataris.scores.familyName >= thresholds.familyName)) {
              // if only the names are used for the match, at least one must be a perfect match, or both must be good enough
              themisMandataris.score = getWeightedScore(themisMandataris.scores);
            }
          } else if (themisMandataris.normalizedFamilyName.indexOf(mandataris.normalizedFamilyName) > -1 || themisMandataris.normalizedFamilyName.indexOf(mandataris.normalizedName) > -1) {
            // this catches the edge case where a Kaleidos name is incomplete.
            // in our testset, this was only the case for demeester - de meyer, but it could technically occur for other names as wel
            themisMandataris.score = getWeightedScore(themisMandataris.scores);
          }
        } else if (themisMandataris.scores.titel >= thresholds.titel) {
          // the title can only be used for a match if none of the names are set
          themisMandataris.score = getWeightedScore(themisMandataris.scores);
        }

        if (themisMandataris.score > 0) {
          possibleMatches.push(themisMandataris);
        } else {
          if (mandataris.normalizedTitel === 'vm tewerkstelling en sociale aangelegenheden' && themisMandataris.normalizedTitel === 'vm van tewerkstelling en sociale aangelegendheden') {
            console.log(mandataris.normalizedFamilyName + ' - '  + mandataris.normalizedTitel + ' ; ' + themisMandataris.normalizedFamilyName + ' - ' + themisMandataris.bestuursfunctieLabel + ' - ' + themisMandataris.normalizedTitel);
            console.log(JSON.stringify(themisMandataris.scores));
          }
        }
      }
    }
  }

  if (possibleMatches.length > 0) {
    // now we need to rank the results and return the best one.
    possibleMatches.sort((a, b) => {
      return b.score - a.score;
    });
    if (enableLogging) {
      console.log('--------');
      console.log('Matching scores for: ');
      console.log(mandataris.name + ' ; ' + mandataris.firstName + ' ; ' + mandataris.familyName + ' ; ' + mandataris.titel);
    }
    // console.log(`Possible Matches for ${mandataris.name ? mandataris.name : '(no name)'} (${mandataris.firstName ? mandataris.firstName : '(no firstName)'} ${mandataris.familyName ? mandataris.familyName : '(no familyName)'})`);
    for (const themisMandataris of possibleMatches) {
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

    if (falseMatches.length > 0) {
      console.log('------------');
      console.log(`Possible false matches for: ${mandataris.name} ; ${mandataris.firstName} ; ${mandataris.familyName} ; ${mandataris.titel} ; ${mandataris.normalizedName} ; ${mandataris.normalizedFamilyName}`);
      for (const falseMatch of falseMatches) {
        console.log('--');
        console.log(falseMatch.voornaam + ' ' + falseMatch.familienaam + ' ; ' + falseMatch.bestuursfunctieLabel + ' ; ' + falseMatch.titel + ' ; ' + falseMatch.normalizedName + ' ; ' + falseMatch.normalizedFamilyName);
        console.log(JSON.stringify(falseMatch.scores));
        console.log(falseMatch.score);
      }
    }
    if (possibleMatches[0].score > 0) {
      return { score: possibleMatches[0].score, ...possibleMatches[0]};
    }
  } else {
    // console.log(`No match found for ${mandataris.name ? mandataris.name : '(no name)'} (${mandataris.firstName ? mandataris.firstName : '(no firstName)'} ${mandataris.familyName ? mandataris.familyName : '(no familyName)'})`);
    // console.log('******************');
    return;
  }
};

export { SIMILARITY_THRESHOLDS, findThemisMandataris };
