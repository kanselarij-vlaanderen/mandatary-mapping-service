/* Module that exports function to query and process the mandatary data in Kaleidos.
The variable naming is a bit weird here, mixing English and Flemish. However, this is to avoid confusion with the data coming out of Themis & Kaleidos */
import { getSimilarity, getWeightedScore } from './similarity/similarity';
import { getMandatarissen } from './queryTools/mandatarissen';
import { getAgendapunten } from './queryTools/agendapunten';
import { getProcedurestappen } from './queryTools/procedurestappen';
import { getPublicatieaangelegenheden } from './queryTools/publicatieaangelegenheden';
import { findSamenstelling } from './queryTools/samenstellingen';
import { findThemisMandataris, SIMILARITY_THRESHOLDS } from './queryTools/themisMatching';

// for debugging
const LIMIT = 0;
const LOGGING = false;

let kaleidosData = {};
// execute this on startup to speed things up
const runMatching = async function () {
  let result = await getMandatarissen();
  if (result) {
    kaleidosData.publicMandatarissen = result.public;
    kaleidosData.kanselarijMandatarissen = result.kanselarij;

    // agendapunten
    let agendapunten = await getAgendapunten(LIMIT);
    let notfound = 0;
    for (let agendapunt of agendapunten) {
      // TODO: which graph should we take here? I'm assuming kanselarij
      agendapunt.kaleidosMandataris = kaleidosData.kanselarijMandatarissen[agendapunt.mandataris] || kaleidosData.publicMandatarissen[agendapunt.mandataris];
      let samenstellingsDatum = agendapunt.geplandeStart || agendapunt.agendaAanmaakdatum || agendapunt.agendaPuntAanmaakdatum;
      if (agendapunt.kaleidosMandataris && samenstellingsDatum) {
        agendapunt.samenstelling = findSamenstelling(agendapunt.kaleidosMandataris, samenstellingsDatum);
        if (agendapunt.samenstelling && agendapunt.samenstelling.mandatarissen) {
          agendapunt.themisMandataris = findThemisMandataris(agendapunt.kaleidosMandataris, agendapunt.samenstelling.mandatarissen, SIMILARITY_THRESHOLDS, LOGGING);
        } else {
          notfound++;
        }
      }
    }
    if (notfound) {
      console.log(`WARNING: samenstelling niet gevonden voor ${notfound} agendapunten.`);
    }
    kaleidosData.agendapunten = agendapunten;

    //procedurestappen
    let procedurestappen = await getProcedurestappen(LIMIT);
    let notfoundProceduresteps = 0;
    for (let procedurestap of procedurestappen) {
      procedurestap.kaleidosMandataris = kaleidosData.kanselarijMandatarissen[procedurestap.mandataris] || kaleidosData.publicMandatarissen[procedurestap.mandataris];
      let samenstellingsDatum = procedurestap.created || procedurestap.modified;
      if (procedurestap.kaleidosMandataris && samenstellingsDatum) {
        procedurestap.samenstelling = findSamenstelling(procedurestap.kaleidosMandataris, samenstellingsDatum);
        if (procedurestap.samenstelling && procedurestap.samenstelling.mandatarissen) {
          procedurestap.themisMandataris = findThemisMandataris(procedurestap.kaleidosMandataris, procedurestap.samenstelling.mandatarissen, SIMILARITY_THRESHOLDS, LOGGING);
        } else {
          notfoundProceduresteps++;
        }
      }
    }
    if (notfoundProceduresteps) {
      console.log(`WARNING: samenstelling niet gevonden voor ${notfoundProceduresteps} procedurestappen.`);
    }
    kaleidosData.procedurestappen = procedurestappen;

    //publicatieaangelegenheden
    let publicatieaangelegenheden = await getPublicatieaangelegenheden(LIMIT);
    let notfoundPublicatieaangelegenheden = 0;
    for (let publicatieaangelegenheid of publicatieaangelegenheden) {
      publicatieaangelegenheid.kaleidosMandataris = kaleidosData.kanselarijMandatarissen[publicatieaangelegenheid.mandataris] || kaleidosData.publicMandatarissen[publicatieaangelegenheid.mandataris];
      let samenstellingsDatum = publicatieaangelegenheid.created || publicatieaangelegenheid.modified;
      if (publicatieaangelegenheid.kaleidosMandataris && samenstellingsDatum) {
        publicatieaangelegenheid.samenstelling = findSamenstelling(publicatieaangelegenheid.kaleidosMandataris, samenstellingsDatum);
        if (publicatieaangelegenheid.samenstelling && publicatieaangelegenheid.samenstelling.mandatarissen) {
          publicatieaangelegenheid.themisMandataris = findThemisMandataris(publicatieaangelegenheid.kaleidosMandataris, publicatieaangelegenheid.samenstelling.mandatarissen, SIMILARITY_THRESHOLDS, LOGGING);
        } else {
          notfoundPublicatieaangelegenheden++;
        }
      }
    }
    if (notfoundPublicatieaangelegenheden) {
      console.log(`WARNING: samenstelling niet gevonden voor ${notfoundPublicatieaangelegenheden} publicatieaangelegenheden.`);
    }
    kaleidosData.publicatieaangelegenheden = publicatieaangelegenheden;
  }
}
runMatching();

export default {
  runMatching: runMatching,

  getAgendapunten: async function (includeSamenstelling) {
    if (!kaleidosData.agendapunten) {
      return { 'error': 'Query still in progress. Try again later.' };
    }
    let agendapunten = [];
    for (let agendapunt of kaleidosData.agendapunten) {
      // don't include the full government composition unless specifically requested, as this makes the result object very heavy
      agendapunten.push({ ...agendapunt, samenstelling: includeSamenstelling ? agendapunt.samenstelling : undefined});
    }
    return agendapunten;
  },

  getProcedurestappen: async function (includeSamenstelling) {
    if (!kaleidosData.procedurestappen) {
      return { 'error': 'Query still in progress. Try again later.' };
    }
    let procedurestappen = [];
    for (let procedurestap of kaleidosData.procedurestappen) {
      // don't include the full government composition unless specifically requested, as this makes the result object very heavy
      procedurestappen.push({ ...procedurestap, samenstelling: includeSamenstelling ? procedurestap.samenstelling : undefined});
    }
    return procedurestappen;
  },

  getPublicatieaangelegenheden: async function (includeSamenstelling) {
    if (!kaleidosData.publicatieaangelegenheden) {
      return { 'error': 'Query still in progress. Try again later.' };
    }
    let publicatieaangelegenheden = [];
    for (let publicatieaangelegenheid of kaleidosData.publicatieaangelegenheden) {
      // don't include the full government composition unless specifically requested, as this makes the result object very heavy
      publicatieaangelegenheden.push({ ...publicatieaangelegenheid, samenstelling: includeSamenstelling ? publicatieaangelegenheid.samenstelling : undefined});
    }
    return publicatieaangelegenheden;
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

  getAgendapuntMatches: async function (includeSamenstelling, baseUrl) {
    if (!kaleidosData.agendapunten) {
      return { 'error': 'Query still in progress. Try again later.' };
    }
    let totalScore = 0;
    let totalScoreCount = 0;
    let themisMandatarissen = {};
    let kaleidosMandatarissen = {};
    let agendapunten = {};
    let results = {
      meta: {
        kaleidosTotal: {
          value: 0,
          description: 'Total number of unique Kaleidos mandataries associated with the agendapoints.',
          links: [`${baseUrl}/mandatarissen`]
        },
        themisTotal: {
          value: 0,
          description: 'Total number of unique Themis mandataries matched with the agendapoints.',
          links: [`${baseUrl}/regeringen`]
        },
        agendapoints: {
          value: 0,
          description: 'Total number of unique agendapoints.',
          links: [`${baseUrl}/agendapunten`]
        },
        results: {
          value: 0,
          description: 'Total number of matchings.',
          links: [`${baseUrl}/agendapunt/matchings`, `${baseUrl}/rerunmatching`]
        },
        missing: {
          value: 0,
          description: 'Number of agendapoints for which no matching mandatary was found in Themis',
          links: [`${baseUrl}/agendapunt/missingthemismandataris`, `${baseUrl}/agendapunt/missingsamenstelling`, `${baseUrl}/agendapunt/missingdates`]
        },
        doubles: {},
        score: {
          min: 0,
          max: 0,
          avg: 0,
          description: 'Minumum, maximum, and average score for the matches.'
        },
        perfectScoringMatches: {
          value: 0,
          description: 'Number of agendapoints that got a Themis match with score 1'
        }
      },
      agendapunten: []
    };
    // group them by themis url && generate some statistics
    for (const agendapunt of kaleidosData.agendapunten) {
      results.meta.results.value++;
      if (agendapunt.mandataris) {
        if (!kaleidosMandatarissen[agendapunt.mandataris]) {
          results.meta.kaleidosTotal.value++;
          kaleidosMandatarissen[agendapunt.mandataris] = [];
        }
        kaleidosMandatarissen[agendapunt.mandataris].push(agendapunt);
      }
      if (agendapunt.themisMandataris) {
        if (!themisMandatarissen[agendapunt.themisMandataris.mandataris]) {
          results.meta.themisTotal.value++;
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
      // some agendapoints are in the results multiple times, due to multiple hits for the triple patterns in the query
      if (agendapunt.agendapunt) {
        if (!agendapunten[agendapunt.agendapunt]) {
          agendapunten[agendapunt.agendapunt] = [];
          results.meta.agendapoints.value++;
        } else {
          if (!results.meta.doubles[agendapunt.agendapunt]) {
            results.meta.doubles[agendapunt.agendapunt] = 1;
          }
          results.meta.doubles[agendapunt.agendapunt]++;
        }
        agendapunten[agendapunt.agendapunt].push(agendapunt);
      }
      // don't include the full government composition unless specifically requested, as this makes the result object very heavy
      results.agendapunten.push({ ...agendapunt, samenstelling: includeSamenstelling ? agendapunt.samenstelling : undefined});
    }
    results.meta.score.avg = totalScoreCount ? 1.0 * totalScore / totalScoreCount : 0;
    delete results.meta.doubles;
    return results;
  },

  getProcedurestapMatches: async function (includeSamenstelling, baseUrl) {
    if (!kaleidosData.procedurestappen) {
      return { 'error': 'Query still in progress. Try again later.' };
    }
    let totalScore = 0;
    let totalScoreCount = 0;
    let themisMandatarissen = {};
    let kaleidosMandatarissen = {};
    let procedurestappen = {};
    let results = {
      meta: {
        kaleidosTotal: {
          value: 0,
          description: 'Total number of unique Kaleidos mandataries associated with the proceduresteps.',
          links: [`${baseUrl}/procedurestap/mandatarissen`]
        },
        themisTotal: {
          value: 0,
          description: 'Total number of unique Themis mandataries matched with the proceduresteps.',
          links: [`${baseUrl}/regeringen`]
        },
        proceduresteps: {
          value: 0,
          description: 'Total number of unique proceduresteps.',
          links: [`${baseUrl}/procedurestappen`]
        },
        results: {
          value: 0,
          description: 'Total number of matchings.',
          links: [`${baseUrl}/procedurestap/matchings`, `${baseUrl}/rerunmatching`]
        },
        missing: {
          value: 0,
          description: 'Number of proceduresteps for which no matching mandatary was found in Themis',
          links: [`${baseUrl}/procedurestap/missingthemismandataris`, `${baseUrl}/procedurestap/missingsamenstelling`, `${baseUrl}/procedurestap/missingdates`]
        },
        doubles: {},
        score: {
          min: 0,
          max: 0,
          avg: 0,
          description: 'Minumum, maximum, and average score for the matches.'
        },
        perfectScoringMatches: {
          value: 0,
          description: 'Number of proceduresteps that got a Themis match with score 1'
        }
      },
      procedurestappen: []
    };
    // group them by themis url && generate some statistics
    for (const procedurestap of kaleidosData.procedurestappen) {
      results.meta.results.value++;
      if (procedurestap.mandataris) {
        if (!kaleidosMandatarissen[procedurestap.mandataris]) {
          results.meta.kaleidosTotal.value++;
          kaleidosMandatarissen[procedurestap.mandataris] = [];
        }
        kaleidosMandatarissen[procedurestap.mandataris].push(procedurestap);
      }
      if (procedurestap.themisMandataris) {
        if (!themisMandatarissen[procedurestap.themisMandataris.mandataris]) {
          results.meta.themisTotal.value++;
          themisMandatarissen[procedurestap.themisMandataris.mandataris] = [];
        }
        themisMandatarissen[procedurestap.themisMandataris.mandataris].push(procedurestap);
        if (procedurestap.themisMandataris && procedurestap.themisMandataris.score) {
          totalScore += procedurestap.themisMandataris.score;
          totalScoreCount++;
          if (!results.meta.score.max || procedurestap.themisMandataris.score > results.meta.score.max) {
            results.meta.score.max = procedurestap.themisMandataris.score;
          }
          if (!results.meta.score.min || procedurestap.themisMandataris.score < results.meta.score.min) {
            results.meta.score.min = procedurestap.themisMandataris.score;
          }
          if (procedurestap.themisMandataris.score === 1) {
            results.meta.perfectScoringMatches.value++;
          }
        }
      } else {
        results.meta.missing.value++;
      }
      // some proceduresteps are in the results multiple times, due to multiple hits for the triple patterns in the query
      if (procedurestap.procedurestap) {
        if (!procedurestappen[procedurestap.procedurestap]) {
          procedurestappen[procedurestap.procedurestap] = [];
          results.meta.proceduresteps.value++;
        } else {
          if (!results.meta.doubles[procedurestap.procedurestap]) {
            results.meta.doubles[procedurestap.procedurestap] = 1;
          }
          results.meta.doubles[procedurestap.procedurestap]++;
        }
        procedurestappen[procedurestap.procedurestap].push(procedurestap);
      }
      // don't include the full government composition unless specifically requested, as this makes the result object very heavy
      results.procedurestappen.push({ ...procedurestap, samenstelling: includeSamenstelling ? procedurestap.samenstelling : undefined});
    }
    results.meta.score.avg = totalScoreCount ? 1.0 * totalScore / totalScoreCount : 0;
    delete results.meta.doubles;
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
