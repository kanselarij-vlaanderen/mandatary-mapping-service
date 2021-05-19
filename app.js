import { app, errorHandler } from 'mu';
import themisData from './util/themisData';
import kaleidosData from './util/kaleidosData';
import jsonParser from './util/jsonParser';
import { isOutlier } from './util/queryTools/outliers';
import { promises as fsp } from 'fs';
import * as path from 'path';

const EXPORT_FILE_PATH = '/data/mapping_export.csv';

const getBaseUrl = function (req) {
  return `${req.protocol}://${req.get('host')}`;
};

// sorts an array in place by a specified JSON property and order (asc or desc)
const sort = function (array, sortBy, order) {
  if (order !== 'asc' && order !== 'desc') {
    order = 'asc';
  }
  array.sort((a, b) => {
    const aProp = jsonParser.getPropertyByPath(a, sortBy);
    const bProp = jsonParser.getPropertyByPath(b, sortBy);
    if (aProp !== undefined && bProp !== undefined) {
      if (aProp > bProp) {
        return order === 'asc' ? 1 : -1;
      } else if (aProp < bProp) {
        return order === 'asc' ? -1 : 1;
      }
    } else if (aProp === undefined && bProp !== undefined) {
      return order === 'asc' ? -1 : 1;
    } else if (aProp !== undefined && bProp === undefined) {
      return order === 'asc' ? 1 : -1;
    }
    return 0;
  });
};

const getMappings = async function (includeSamenstelling) {
  let matchings = await kaleidosData.getAgendapuntMatches(includeSamenstelling);
  if (!matchings.agendapunten) {
    return 'Query not finished yet. Try again later.';
  }
  let mappings = {};
  if (matchings && matchings.agendapunten) {
    for (const agendapunt of matchings.agendapunten) {
      if (agendapunt.kaleidosMandataris && agendapunt.kaleidosMandataris.mandataris) {
        if (!mappings[agendapunt.kaleidosMandataris.mandataris]) {
          mappings[agendapunt.kaleidosMandataris.mandataris] = {
            // person: agendapunt.kaleidosMandataris.person,
            // firstName: agendapunt.kaleidosMandataris.firstName,
            // familyName: agendapunt.kaleidosMandataris.familyName,
            // name: agendapunt.kaleidosMandataris.name,
            // titel: agendapunt.kaleidosMandataris.titel,
            ...agendapunt.kaleidosMandataris,
            themisMandatarissen: {}
          };
        }
        if (agendapunt.themisMandataris) {
          if (!mappings[agendapunt.kaleidosMandataris.mandataris].themisMandatarissen[agendapunt.themisMandataris.mandataris]) {
            mappings[agendapunt.kaleidosMandataris.mandataris].themisMandatarissen[agendapunt.themisMandataris.mandataris] = {
              // persoon: agendapunt.themisMandataris.persoon,
              // voornaam: agendapunt.themisMandataris.voornaam,
              // familienaam: agendapunt.themisMandataris.familienaam,
              // bestuursfunctieLabel: agendapunt.themisMandataris.bestuursfunctieLabel,
              // titel: agendapunt.themisMandataris.titel,
              ...agendapunt.themisMandataris,
              agendapunten: []
            }
          }
          mappings[agendapunt.kaleidosMandataris.mandataris].themisMandatarissen[agendapunt.themisMandataris.mandataris].agendapunten.push(agendapunt.agendapunt);
        }
      }
    }
  }
  // now turn this into an array
  let mappingsArray = [];
  for (const mandataris in mappings) {
    if (mappings.hasOwnProperty(mandataris)) {
      let kaleidosMandataris = {
        kaleidosMandataris: {
          mandataris: mandataris,
          ...mappings[mandataris],
          themisMandatarissen: undefined
        },
        themisMandatarissen: mappings[mandataris].themisMandatarissen
      };
      if (kaleidosMandataris.themisMandatarissen) {
        let minScore = 2;
        let person;
        for (const themisMandataris in kaleidosMandataris.themisMandatarissen) {
          if (kaleidosMandataris.themisMandatarissen.hasOwnProperty(themisMandataris)) {
            if (kaleidosMandataris.themisMandatarissen[themisMandataris].score <= minScore) {
              minScore = kaleidosMandataris.themisMandatarissen[themisMandataris].score;
            }
            // while we're looping through these anyway, just a quality check to see if there are multiple persons linked to the Kaleidos mandatary, which could be a red flag
            if (kaleidosMandataris.themisMandatarissen[themisMandataris].persoon) {
              if (!person) {
                person = kaleidosMandataris.themisMandatarissen[themisMandataris].persoon;
              }
              if (kaleidosMandataris.themisMandatarissen[themisMandataris].persoon !== person) {
                console.log(`WARNING: kaleidosMandataris ${mandataris.mandataris} is linked to multiple persons, which should be impossible.`);
              }
            }
          }
        }
        kaleidosMandataris.minScore = minScore;
      }
      mappingsArray.push(kaleidosMandataris);
    }
  }
  // and sort it by ascending score for easy debugging
  sort(mappingsArray, 'minScore', 'asc');
  return mappingsArray;
};

app.get('/', function(req, res) {
  res.send('Try /regeringen or /mandatarissen or /matchings');
} );


/* Get an object with all government compositions grouped by start date */
app.get('/regeringen', async function(req, res) {
  res.send(themisData);
});

app.get('/mandatarissen', async function(req, res) {
  let graph = req.query.graph || 'public';
  let mandatarissen = await kaleidosData.getMandatarissen(graph);
  res.send(mandatarissen);
});

// useful query to gain insight: http://localhost:8888/matchings?limit=100&sortBy=themisMandataris.score&order=asc
app.get('/matchings', async function(req, res) {
  let baseUrl = getBaseUrl(req);
  let matchings = await kaleidosData.getAgendapuntMatches(req.query.includeSamenstelling, baseUrl);
  if (!matchings.agendapunten) {
    return res.send('Query not finished yet. Try again later.');
  }
  matchings.agendapunten = matchings.agendapunten.filter((agendapunt) => { return agendapunt.themisMandataris !== undefined; });
  if (req.query && req.query.sortBy) {
    sort(matchings.agendapunten, req.query.sortBy, req.query.order);
  }
  if (req.query && +req.query.limit) {
    matchings.agendapunten = matchings.agendapunten.slice(0, +req.query.limit);
  }
  res.send(matchings);
});

app.get('/missingthemismandataris', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten(req.query.includeSamenstelling);
  let includeSkipped = req.query && req.query.includeSkipped;
  let skipped = 0;
  let filtered = agendapunten.filter((agendapunt) => {
    let outlier = isOutlier(agendapunt.kaleidosMandataris);
    if (outlier) {
      skipped++;
    }
    return (!outlier || includeSkipped) && !agendapunt.themisMandataris
  });
  // group them by kaleidosMandataris
  let grouped = {
    skipped: skipped,
    count: 0,
    mandatarissen: {}
  };
  for (const agendapunt of filtered) {
    if (!grouped.mandatarissen[agendapunt.kaleidosMandataris.mandataris]) {
      grouped.count++;
      grouped.mandatarissen[agendapunt.kaleidosMandataris.mandataris] = { count: 0, agendapunten: [] };
    }
    grouped.mandatarissen[agendapunt.kaleidosMandataris.mandataris].count++;
    grouped.mandatarissen[agendapunt.kaleidosMandataris.mandataris].agendapunten.push(agendapunt);
  }
  res.send(JSON.stringify(grouped));
});

// returns agendapoints missing a government compositions. Returns an empty array, was used for debugging
app.get('/missingsamenstelling', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten(true);
  let filtered = agendapunten.filter((agendapunt) => { return !agendapunt.samenstelling });
  res.send(JSON.stringify(filtered));
});

// returns missing dates for government compositions. Returns an empty array, was used for debugging
app.get('/missingdates', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten(true);
  let missing = agendapunten.filter((agendapunt) => { return !agendapunt.samenstelling });
  let dates = {};
  for (const agendapunt of missing) {
    dates[agendapunt.geplandeStart] = agendapunt.geplandeStart;
  }
  res.send(dates);
});

app.get('/matchings/meta', async function(req, res) {
  let matchings = await kaleidosData.getAgendapuntMatches();
  res.send(matchings.meta);
});

app.get('/agendapunten', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten();
  res.send(agendapunten);
});

// useful when developing with live-reload
app.get('/rerunmatching', async function(req, res) {
  await kaleidosData.runMatching();
  res.send('rerun of matching has finished');
});

// returns all unique Kaleidos mandataries, along with which themis mandataries they were matched to, for which agendapoints
// useful query to gain insight: http://localhost:8888/mandatarismapping?sortBy=themisMandataris.score&order=asc
app.get('/mandatarismapping', async function(req, res) {
  res.send(await getMappings(req.query.includeSamenstelling));
});

/* Generate a CSV with kaleidos mandatary, mapped themis mandatary, and agendapoints for which the mapping occurred */
app.get('/generateMappingCSV', async function(req, res) {
  let csvString = 'sep=;\n';
  let mappings = await getMappings();
  csvString += `kaleidosMandataris.name;kaleidosMandataris.firstName;kaleidosMandataris.familyName;kaleidosMandataris.titel;themisMandataris.voornaam;themisMandataris.familienaam;themisMandataris.bestuursfunctieLabel;themisMandataris.titel;minimale similariteit-score;aantal agendapunten;kaleidosMandataris URL; themisMandataris URL\n`;
  if (mappings && Array.isArray(mappings)) {
    for (const mapping of mappings) {
      for (const themisUrl in mapping.themisMandatarissen) {
        if (mapping.themisMandatarissen.hasOwnProperty(themisUrl)) {
          csvString += `${mapping.kaleidosMandataris.name};${mapping.kaleidosMandataris.firstName};${mapping.kaleidosMandataris.familyName};${mapping.kaleidosMandataris.titel};${mapping.themisMandatarissen[themisUrl].voornaam};${mapping.themisMandatarissen[themisUrl].familienaam};${mapping.themisMandatarissen[themisUrl].bestuursfunctieLabel};${mapping.themisMandatarissen[themisUrl].titel};${mapping.minScore};${mapping.themisMandatarissen[themisUrl].agendapunten.length};${mapping.kaleidosMandataris.mandataris};${mapping.themisMandatarissen[themisUrl].mandataris}\n`;
        }
      }
    }
  }
  csvString = csvString.replace(/undefined/g, '');
  await fsp.writeFile(path.resolve(EXPORT_FILE_PATH), csvString);
  res.send('CSV generated at ' + path.resolve(EXPORT_FILE_PATH));
});

app.use(errorHandler);
