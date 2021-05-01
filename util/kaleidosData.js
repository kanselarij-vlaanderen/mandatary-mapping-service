/* Module that exports function to query and process the mandatary data in Kaleidos.
The variable naming is a bit weird here, mixing English and Flemish. However, this is to avoid confusion with the data coming out of Themis & Kaleidos */
import { getSimilarity, getWeightedScore } from './similarity/similarity';
import { getMandatarissen } from './queryTools/mandatarissen';
import { getAgendapunten } from './queryTools/agendapunten';
import { findSamenstelling } from './queryTools/samenstellingen';
import { findThemisMandataris } from './queryTools/themisMatching';

// for debugging
const LIMIT = 1000;

let kaleidosData = {};
// execute this on startup to speed things up
getMandatarissen(LIMIT).then(async (result) => {
  if (result) {
    kaleidosData.publicMandatarissen = result.public;
    kaleidosData.kanselarijMandatarissen = result.kanselarij;

    let agendapunten = await getAgendapunten(LIMIT);
    let notfound = 0;
    for (let agendapunt of agendapunten) {
      // TODO: which graph should we take here? I'm assuming kanselarij
      agendapunt.kaleidosMandataris = kaleidosData.kanselarijMandatarissen[agendapunt.mandataris] || kaleidosData.publicMandatarissen[agendapunt.mandataris];
      let samenstellingsDatum = agendapunt.geplandeStart || agendapunt.agendaAanmaakdatum || agendapunt.agendaPuntAanmaakdatum;
      if (agendapunt.kaleidosMandataris && samenstellingsDatum) {
        agendapunt.samenstelling = findSamenstelling(agendapunt.kaleidosMandataris, samenstellingsDatum);
        if (agendapunt.samenstelling && agendapunt.samenstelling.mandatarissen) {
          agendapunt.themisMandataris = findThemisMandataris(agendapunt.kaleidosMandataris, agendapunt.samenstelling.mandatarissen);
        } else {
          notfound++;
        }
      }
    }
    console.log(`WARNING: samenstelling niet gevonden voor ${notfound} agendapunten.`);
    kaleidosData.agendapunten = agendapunten;
  }
});

export default {

  getAgendapunten: async function () {
    if (!kaleidosData.agendapunten) {
      return { 'error': 'Query still in progress. Try again later.' };
    }
    return kaleidosData.agendapunten;
  },

  getMandatarissen: async function (graph) {
    if (!kaleidosData.publicMandatarissen || !kaleidosData.kanselarijMandatarissen) {
      let result = await getMandatarissen(LIMIT);
      if (result) {
        kaleidosData.publicMandatarissen = result.public;
        kaleidosData.kanselarijMandatarissen = result.kanselarij;
      }
    }
    switch (graph) {
      case 'kanselarij':
        return kaleidosData.kanselarijMandatarissen;
        break;
      default:
        return kaleidosData.publicMandatarissen;
    }
  },

  getAgendapuntMatches: async function () {
    if (!kaleidosData.agendapunten) {
      return { 'error': 'Query still in progress. Try again later.' };
    }
    let totalScore = 0;
    let totalScoreCount = 0;
    let themisMandatarissen = {};
    let kaleidosMandatarissen = {};
    let results = {
      meta: {
        kaleidosTotal: {
          value: 0,
          description: 'Total number of Kaleidos mandataries.'
        },
        themisTotal: {
          value: 0,
          description: 'Total number of Themis mandataries.'
        },
        correct: {
          value: 0,
          description: 'Number of Kaleidos mandataries for which no other Kaleidos mandatary was matched to the same mandatary in Themis.'
        },
        double: {
          value: 0,
          description: 'Number of Kaleidos mandataries for which at least one other Kaleidos mandatary was matched to the same mandatary in Themis.'
        },
        missing: {
          value: 0,
          description: 'Number of Kaleidos mandataries for which no matching mandatary was found in Themis'
        },
        score: {
          min: 0,
          max: 0,
          avg: 0,
          description: 'Minumum, maximum, and average score for the matches.'
        },
        perfectScoringMatches: {
          value: 0,
          description: 'Number of Kaleidos mandataries that got a Themis match with score 1'
        },
        similarityThresholds: {
          value: SIMILARITY_THRESHOLDS,
          description: 'Similarity threshold used for the matching algorithm.'
        }
      },
      agendapunten: kaleidosData.agendapunten
    };
    // group them by themis url && generate some statistics
    for (const agendapunt of kaleidosData.agendapunten) {
      if (agendapunt.mandataris) {
        if (!kaleidosMandatarissen[agendapunt.mandataris]) {
          results.meta.kaleidosTotal++;
          kaleidosMandatarissen[agendapunt.mandataris] = [];
        }
        kaleidosMandatarissen[agendapunt.mandataris].push(agendapunt);
      }
      if (agendapunt.themisMandataris) {
        if (!results.mandatarissen[agendapunt.themisMandataris.mandataris]) {
          results.meta.themisTotal++;
          themisMandatarissen[agendapunt.themisMandataris.mandataris] = [];
        }
        themisMandatarissen[agendapunt.themisMandataris.mandataris].push(agendapunt);
        if (agendapunt.themisMandataris && agendapunt.themisMandataris.score) {
          totalScore += agendapunt.themisMandataris.score;
          totalScoreCount++;
          if (!results.meta.score.max || agendapunt.themisMandataris.score > results.meta.score.max) {
            results.meta.score.max = agendapunt.themisMandataris.score;
          }
          if (!results.meta.score.min || agendapunt.themisMandataris.score < results.meta.score.min) {
            results.meta.score.min = agendapunt.themisMandataris.score;
          }
          if (agendapunt.themisMandataris.score === 1) {
            results.meta.perfectScoringMatches.value++;
          }
        }
      } else {
        results.meta.missing.value++;
      }
    }
    results.meta.score.avg = totalScoreCount ? 1.0 * totalScore / totalScoreCount : 0;

    return results;
  },

  /* Get all triples for all matched mandataries */
  getTriples: async function () {
    if (!kaleidosData.mandatarissen || kaleidosData.mandatarissen.length === 0) {
      await getThemisMatches();
    }
    let groupedResults = {};
    for (const mandataris of kaleidosData.mandatarissen) {
      let triples = await getTriplesForMandataris(mandataris);
      groupedResults[mandataris.mandataris] = triples;
    }
    return groupedResults;
  }
};
