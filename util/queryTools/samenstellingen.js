/* This module exports a function to find a government composition in Themis for a mandatary at a given date.
The variable naming is a bit weird here, mixing English and Flemish. However, this is to avoid confusion with the data coming out of Themis & Kaleidos */
import themisData from '../themisData';

/* Find a government composition for a mandatary at a given date */
const findSamenstelling = function (mandataris, date) {
  if (mandataris && date) {
    let lookupDate = new Date(date);
    for (const regeringsUrl in themisData.regeringen) {
      if (themisData.regeringen.hasOwnProperty(regeringsUrl)) {
        const regering = themisData.regeringen[regeringsUrl];
        for (const samenstellingStart in regering.samenstellingen) {
          if (regering.samenstellingen.hasOwnProperty(samenstellingStart)) {
            let startDate = new Date(regering.samenstellingen[samenstellingStart].start);
            let endDate = regering.samenstellingen[samenstellingStart].einde ? new Date(regering.samenstellingen[samenstellingStart].einde) : undefined;
            if (startDate && lookupDate >= startDate) {
              if (!endDate || lookupDate <= endDate) {
                return regering.samenstellingen[samenstellingStart];
              }
            }
          }
        }
      }
    }
  }
};

export { findSamenstelling };


// DEPRECATED
// These functions were used to match a mandataris based on the start date in Kaleidos,
// but in the meantime it has become clear that that is a bad approach, since the start/end dates in Kaleidos are too far off.
// this matches the start date exactly
const findSamenstellingByStartDate = function (startDateString) {
  let formattedStart = startDateString.substring(0,10); // get rid of any hours/minute/seconds suffixes we don't need
  for (const regeringsUrl in themisData.regeringen) {
    if (themisData.regeringen.hasOwnProperty(regeringsUrl)) {
      const regering = themisData.regeringen[regeringsUrl];
      for (const samenstellingStart in regering.samenstellingen) {
        if (regering.samenstellingen.hasOwnProperty(samenstellingStart)) {
          if (formattedStart === samenstellingStart) {
            return regering.samenstellingen[samenstellingStart];
          }
        }
      }
    }
  }
  return;
};

// DEPRECATED
// this matches the end date exactly
const findSamenstellingByEndDate = function (endDateString) {
  let formattedEnd = endDateString.substring(0,10); // get rid of any hours/minute/seconds suffixes we don't need
  for (const regeringsUrl in themisData.regeringen) {
    if (themisData.regeringen.hasOwnProperty(regeringsUrl)) {
      const regering = themisData.regeringen[regeringsUrl];
      for (const samenstellingStart in regering.samenstellingen) {
        if (regering.samenstellingen.hasOwnProperty(samenstellingStart)) {
          const samenstellingEinde = regering.samenstellingen[samenstellingStart].einde ? regering.samenstellingen[samenstellingStart].einde.substring(0,10) : undefined;
          if (formattedEnd === samenstellingEinde) {
            return regering.samenstellingen[samenstellingStart];
          }
        }
      }
    }
  }
  return;
};

// DEPRECATED
// this matches the start and end date, allowing for one day off for each
const findSamenstellingByFuzzyDateMatch = function (startDateString, endDateString) {
  // if we get to this point, the start/end dates often mismatch by one, with the fault being in Kaleidos
  // so let's compare the mandatary dates to 1 day before and after
  let formattedStartPlusOne = '';
  let formattedStartMinusOne = '';
  if (startDateString) {
    let day = +startDateString.substring(8,10);
    let plusZero = (day + 1) < 10 ? '0' : '';
    let minusZero = (day + 1) < 10 ? '0' : '';
    formattedStartPlusOne = startDateString.substring(0,8) + plusZero + (day + 1);
    formattedStartMinusOne = startDateString.substring(0,8) + minusZero + (day - 1);
  }
  let formattedEndPlusOne = '';
  let formattedEndMinusOne = '';
  if (endDateString) {
    let day = +endDateString.substring(8,10);
    let plusZero = (day + 1) < 10 ? '0' : '';
    let minusZero = (day + 1) < 10 ? '0' : '';
    formattedEndPlusOne = endDateString.substring(0,8) + plusZero + (day + 1);
    formattedEndMinusOne = endDateString.substring(0,8) + minusZero + (day - 1);
  }
  let maxSamenstelling;
  let bestScore = 0;
  for (const regeringsUrl in themisData.regeringen) {
    if (themisData.regeringen.hasOwnProperty(regeringsUrl)) {
      const regering = themisData.regeringen[regeringsUrl];
      for (const samenstellingStart in regering.samenstellingen) {
        if (regering.samenstellingen.hasOwnProperty(samenstellingStart)) {
          const samenstellingEinde = regering.samenstellingen[samenstellingStart].einde ? regering.samenstellingen[samenstellingStart].einde.substring(0,10) : undefined;
          let score = 0;
          if (samenstellingStart === formattedStartPlusOne || samenstellingStart === formattedStartMinusOne) {
            score++;
          }
          if (samenstellingEinde === formattedEndPlusOne || samenstellingEinde === formattedEndMinusOne) {
            score++;
          }
          if (score > bestScore) {
            bestScore = score;
            maxSamenstelling = regering.samenstellingen[samenstellingStart];
          }
        }
      }
    }
  }
  return maxSamenstelling;
};
