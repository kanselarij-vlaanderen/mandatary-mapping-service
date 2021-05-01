// deprecated approach. kept solely as reference

/* returns an object structured as
  {
    matched: // array with the mandataries who got a themis match
    noStarts: // array with mandataries that had no start date and thus could not be matched to a government composition.
    unMatchables: // array with mandataries that could not be matched to a known government composition.
    belowThreshold: // array with mandataries that could not be matched to a known member of their matched government composition.
  }
*/
const getDatefilteredThemisMatches = function (mandatarissen) {
  // for each mandataris in kaleidos, try to find the matching one in themis.
  // we know that the themis data is correct, so if we find the same match twice, we'll know it's a duplicate
  let matched = [];
  let noStarts = [];
  let unMatchables = [];
  let belowThreshold = [];
  for (const mandataris of mandatarissen) {
    // first find the matching government composition, so we can narrow down the search searchSet
    let samenstelling = findSamenstelling(mandataris);
    // now we can look for the right mandatary in the matched government composition
    if (samenstelling && !samenstelling.unMatchable) {
      let themisMandataris = findThemisMandatary(mandataris, samenstelling.mandatarissen);
      if (themisMandataris) {
        mandataris.themisMandataris = themisMandataris;
        matched.push(mandataris);
      } else {
        belowThreshold.push(mandataris);
      }
    } else if (samenstelling.unMatchable && samenstelling.reason === 'start undefined') {
      noStarts.push(mandataris);
    } else if (samenstelling.unMatchable && samenstelling.reason === 'not found') {
      unMatchables.push(mandataris);
    }
  }
  console.log('Matching done.');
  if (noStarts.length) {
    console.log('WARNING: ' + noStarts.length + ' mandataries had no start date and thus could not be matched to a government composition.'); // this should be 0
  }
  if (unMatchables.length) {
    console.log('WARNING: ' + unMatchables.length + ' mandataries could not be matched to a known government composition.');
  }
  if (belowThreshold.length) {
    console.log('WARNING: ' + belowThreshold.length + ' mandataries could not be matched to a known member of their matched government composition.');
  }
  return { matched, noStarts, unMatchables, belowThreshold };
};

const getThemisMatches = async function () {
  if (!kaleidosData.mandatarissen || kaleidosData.mandatarissen.length === 0) {
    await getMandatarissen();
  }
  // for each mandataris in kaleidos, try to find the matching one in themis.
  // we know that the themis data is correct, so if we find the same match twice, we'll know it's a duplicate
  let mandatarissen = kaleidosData.mandatarissen;
  // first try using only the matching government compositions
  let results = getDatefilteredThemisMatches(kaleidosData.mandatarissen);
  console.log(`Matched ${results.matched.length} mandataries.`);
  // for the remaining ones, try finding a match in all of themis
  let remainingMandatarissen = [...results.noStarts, ...results.unMatchables, ...results.belowThreshold];
  let matched = [];
  let unMatchables = [];
  for (const mandataris of remainingMandatarissen) {
    let themisMandataris = findThemisMandatary(mandataris);
    if (themisMandataris) {
      mandataris.themisMandataris = themisMandataris;
      matched.push(mandataris);
    } else {
      unMatchables.push(mandataris);
    }
  }
  console.log('Matching done.');
  console.log(`Matched ${matched.length} remaining mandataries.`);
  if (unMatchables.length) {
    console.log('WARNING: ' + unMatchables.length + ' mandataries could not be matched to a themis mandatary.');
  }
};
