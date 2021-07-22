import { app, errorHandler } from 'mu';
import themisData from './util/themisData';
import kaleidosData from './util/kaleidosData';
import { getMeetingAndAgenda } from './util/queryTools/agendapunten';
import { getTriplesForMandataris } from './util/queryTools/mandatarissen';
import jsonParser from './util/jsonParser';
import { isOutlier } from './util/queryTools/outliers';
import { promises as fsp } from 'fs';
import * as path from 'path';

const MAPPING_EXPORT_FILE_PATH = '/data/mapping_export.csv';
const TTL_EXPORT_FILE_PATH = '/data/insert-';
const SPARQL_EXPORT_FILE_PATH = '/data/mandatary-mapping.sparql';
const MISSING_EXPORT_FILE_PATH = '/data/missing_export.csv';

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

const getMissingAgendapunten = async function (includeSamenstelling, includeSkipped) {
  let agendapunten = await kaleidosData.getAgendapunten(includeSamenstelling);
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
      grouped.mandatarissen[agendapunt.kaleidosMandataris.mandataris] = { count: 0, agendapunten: [], ...agendapunt.kaleidosMandataris };
    }
    grouped.mandatarissen[agendapunt.kaleidosMandataris.mandataris].count++;
    grouped.mandatarissen[agendapunt.kaleidosMandataris.mandataris].agendapunten.push(agendapunt);
  }
  return grouped;
}

const getMissingProcedurestappen = async function (includeSamenstelling, includeSkipped) {
  let procedurestappen = await kaleidosData.getProcedurestappen(includeSamenstelling);
  let skipped = 0;
  let filtered = procedurestappen.filter((procedurestap) => {
    let outlier = isOutlier(procedurestap.kaleidosMandataris);
    if (outlier) {
      skipped++;
    }
    return (!outlier || includeSkipped) && !procedurestap.themisMandataris
  });
  // group them by kaleidosMandataris
  let grouped = {
    skipped: skipped,
    count: 0,
    mandatarissen: {}
  };
  for (const procedurestap of filtered) {
    if (!grouped.mandatarissen[procedurestap.kaleidosMandataris.mandataris]) {
      grouped.count++;
      grouped.mandatarissen[procedurestap.kaleidosMandataris.mandataris] = { count: 0, procedurestappen: [], ...procedurestap.kaleidosMandataris };
    }
    grouped.mandatarissen[procedurestap.kaleidosMandataris.mandataris].count++;
    grouped.mandatarissen[procedurestap.kaleidosMandataris.mandataris].procedurestappen.push(procedurestap);
  }
  return grouped;
}

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
app.get('/agendapunt/matchings', async function(req, res) {
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

app.get('/agendapunt/missingthemismandataris', async function(req, res) {
  let grouped = await getMissingAgendapunten(req.query.includeSamenstelling, req.query.includeSkipped);
  res.send(JSON.stringify(grouped));
});

// returns agendapoints missing a government compositions. Returns an empty array, was used for debugging
app.get('/agendapunt/missingsamenstelling', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten(true);
  let filtered = agendapunten.filter((agendapunt) => { return !agendapunt.samenstelling });
  res.send(JSON.stringify(filtered));
});

// returns missing dates for government compositions. Returns an empty array, was used for debugging
app.get('/agendapunt/missingdates', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten(true);
  let missing = agendapunten.filter((agendapunt) => { return !agendapunt.samenstelling });
  let dates = {};
  for (const agendapunt of missing) {
    dates[agendapunt.geplandeStart] = agendapunt.geplandeStart;
  }
  res.send(dates);
});

app.get('/agendapunt/matchings/meta', async function(req, res) {
  let matchings = await kaleidosData.getAgendapuntMatches();
  res.send(matchings.meta);
});

app.get('/agendapunten', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten(req.query.includeSamenstelling);
  res.send(agendapunten);
});

// useful query to gain insight: http://localhost:8888/matchings?limit=100&sortBy=themisMandataris.score&order=asc
app.get('/procedurestap/matchings', async function(req, res) {
  let baseUrl = getBaseUrl(req);
  let matchings = await kaleidosData.getProcedurestapMatches(req.query.includeSamenstelling, baseUrl);
  if (!matchings.procedurestappen) {
    return res.send('Query not finished yet. Try again later.');
  }
  matchings.procedurestappen = matchings.procedurestappen.filter((procedurestap) => { return procedurestap.themisMandataris !== undefined; });
  if (req.query && req.query.sortBy) {
    sort(matchings.procedurestappen, req.query.sortBy, req.query.order);
  }
  if (req.query && +req.query.limit) {
    matchings.procedurestappen = matchings.procedurestappen.slice(0, +req.query.limit);
  }
  res.send(matchings);
});

app.get('/procedurestap/missingthemismandataris', async function(req, res) {
  let grouped = await getMissingProcedurestappen(req.query.includeSamenstelling, req.query.includeSkipped);
  res.send(JSON.stringify(grouped));
});

// returns agendapoints missing a government compositions. Returns an empty array, was used for debugging
app.get('/procedurestap/missingsamenstelling', async function(req, res) {
  let procedurestappen = await kaleidosData.getProcedurestappen(true);
  let filtered = procedurestappen.filter((procedurestap) => { return !procedurestap.samenstelling });
  res.send(JSON.stringify(filtered));
});

// returns missing dates for government compositions. Returns an empty array, was used for debugging
app.get('/procedurestap/missingdates', async function(req, res) {
  let procedurestappen = await kaleidosData.getProcedurestappen(true);
  let missing = procedurestappen.filter((procedurestap) => { return !procedurestap.samenstelling });
  let dates = {};
  for (const procedurestap of missing) {
    dates[procedurestap.created] = agendapunt.created;
  }
  res.send(dates);
});

app.get('/procedurestap/matchings/meta', async function(req, res) {
  let matchings = await kaleidosData.getProcedurestapMatches();
  res.send(matchings.meta);
});

app.get('/procedurestappen', async function(req, res) {
  let procedurestappen = await kaleidosData.getProcedurestappen(req.query.includeSamenstelling);
  res.send(procedurestappen);
});

app.get('/publicatieaangelegenheden', async function(req, res) {
  let publicatieaangelegenheden = await kaleidosData.getPublicatieaangelegenheden(req.query.includeSamenstelling);
  res.send(publicatieaangelegenheden);
});

// useful when developing with live-reload
app.get('/rerunmatching', async function(req, res) {
  await kaleidosData.runMatching();
  res.send('rerun of matching has finished');
});

// returns all unique Kaleidos mandataries, along with which themis mandataries they were matched to, for which agendapoints
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
  await fsp.writeFile(path.resolve(MAPPING_EXPORT_FILE_PATH), csvString);
  res.send('CSV generated at ' + path.resolve(MAPPING_EXPORT_FILE_PATH));
});

/* Generate a CSV with missing mandataries */
app.get('/generateMissingCSV', async function(req, res) {
  let csvString = 'sep=;\n';
  csvString += `name;firstName;familyName;titel;aantal agendapunten\n`;
  let grouped = await getMissingAgendapunten(req.query.includeSamenstelling, req.query.includeSkipped);
  for (const key in grouped.mandatarissen) {
    if (grouped.mandatarissen.hasOwnProperty(key)) {
      let mandataris = grouped.mandatarissen[key];
      csvString += `${mandataris.name};${mandataris.firstName};${mandataris.familyName};${mandataris.titel};${mandataris.agendapunten.length}\n`;
    }
  }
  csvString = csvString.replace(/undefined/g, '');
  await fsp.writeFile(path.resolve(MISSING_EXPORT_FILE_PATH), csvString);
  res.send('CSV generated at ' + path.resolve(MISSING_EXPORT_FILE_PATH));
});

app.get('/agendapunt/generateMissingReport', async function(req, res) {
  let grouped = await getMissingAgendapunten(true, req.query.includeSkipped);
  let exportHTML = `<!doctype html>
<html lang="en">
  <head>
  <meta charset="utf-8">
  <title>Kaleidos mandatarissen zonder gevonden link naar Themis mandataris</title>
  </head>
  <body>
  <h1>Kaleidos mandatarissen zonder gevonden link naar Themis mandataris</h1>`;
  for (const key in grouped.mandatarissen) {
    if (grouped.mandatarissen.hasOwnProperty(key)) {
      let mandataris = grouped.mandatarissen[key];
      exportHTML += `
      <section>
        <h2>Kaleidos mandataris data voor: ${mandataris.name ? mandataris.name : mandataris.firstName + ' ' + mandataris.familyName}</h2>
        <div>Database URI: <a href="${mandataris.mandataris}">${mandataris.mandataris}</a></div>
        <div>name: ${mandataris.name}</div>
        <div>firstName: ${mandataris.firstName}</div>
        <div>familyName: ${mandataris.familyName}</div>
        <div>titel: ${mandataris.titel}</div>
        <h3>Gelinkte agendapunten (${mandataris.agendapunten.length}):</h3>`;
        for (const agendapunt of mandataris.agendapunten) {
          exportHTML += `<h4>Agenda van ${agendapunt.geplandeStart ? new Date(agendapunt.geplandeStart).toLocaleString('nl-BE') : 'geen datum beschikbaar'}</h4>`;
          exportHTML += `<div>Agendapunt titel: ${agendapunt.agendaPuntTitel}`;
          exportHTML += `<div>Database URI: <a href="${agendapunt.agendapunt}">${agendapunt.agendapunt}</a></div>`;
          const agendapuntId = agendapunt.agendapunt.substring(agendapunt.agendapunt.lastIndexOf('/') + 1);
          const meetingId = agendapunt.meeting.substring(agendapunt.meeting.lastIndexOf('/') + 1);
          const agendaId = agendapunt.agenda.substring(agendapunt.agenda.lastIndexOf('/') + 1);
          exportHTML += `<div><a target="_blank" href="https://kaleidos-test.vlaanderen.be/vergadering/${meetingId}/agenda/${agendaId}/agendapunten/${agendapuntId}">Bekijk dit agendapunt op kaleidos test omgeving</a></div>\n`;
          exportHTML += `<div><a target="_blank" href="https://kaleidos.vlaanderen.be/vergadering/${meetingId}/agenda/${agendaId}/agendapunten/${agendapuntId}">Bekijk dit agendapunt op kaleidos productie omgeving</a></div>\n`;
          let themisUrl = `https://themis-test.vlaanderen.be/view/government-body?resource=${agendapunt.samenstelling.mandatarissen[0].regering}`;
          exportHTML += `<div><a target="_blank" href="${themisUrl}">Bekijk de samenstelling Vlaamse regering in Themis ten tijde van dit agendapunt</a></div>\n`;
        }
        exportHTML += `</section>`;
    }
  }
  exportHTML += `
  </body>
</html>`;
  res.type('html');
  res.send(exportHTML);
});

app.get('/procedurestap/generateMissingReport', async function(req, res) {
  let grouped = await getMissingProcedurestappen(true, req.query.includeSkipped);
  let exportHTML = `<!doctype html>
<html lang="en">
  <head>
  <meta charset="utf-8">
  <title>Kaleidos mandatarissen zonder gevonden link naar Themis mandataris</title>
  </head>
  <body>
  <h1>Kaleidos mandatarissen zonder gevonden link naar Themis mandataris</h1>`;
  for (const key in grouped.mandatarissen) {
    if (grouped.mandatarissen.hasOwnProperty(key)) {
      let mandataris = grouped.mandatarissen[key];
      exportHTML += `
      <section>
        <h2>Kaleidos mandataris data voor: ${mandataris.name ? mandataris.name : mandataris.firstName || mandataris.familyName ? mandataris.firstName + ' ' + mandataris.familyName : mandataris.titel}</h2>
        <div>Database URI: <a href="${mandataris.mandataris}">${mandataris.mandataris}</a></div>
        <div>name: ${mandataris.name}</div>
        <div>firstName: ${mandataris.firstName}</div>
        <div>familyName: ${mandataris.familyName}</div>
        <div>titel: ${mandataris.titel}</div>
        <h3>Gelinkte procedurestappen (${mandataris.procedurestappen.length}):</h3>`;
        for (const procedurestap of mandataris.procedurestappen) {
          exportHTML += `<h4>Procedurestap op ${procedurestap.created ? new Date(procedurestap.created).toLocaleString('nl-BE') : 'geen datum beschikbaar'}</h4>`;
          exportHTML += `<div>Procedurestap relatie: ${procedurestap.relation}`;
          exportHTML += `<div>Procedurestap titel: ${procedurestap.titel}`;
          exportHTML += `<div>Procedurestap alternative: ${procedurestap.alternative}`;
          exportHTML += `<div>Procedurestap naam: ${procedurestap.procedurestapNaam}`;
          exportHTML += `<div>Database URI: <a href="${procedurestap.procedurestap}">${procedurestap.procedurestap}</a></div>`;
          const procedurestapId = procedurestap.procedurestap.substring(procedurestap.procedurestap.lastIndexOf('/') + 1);
          const dossierId = procedurestap.dossier ? procedurestap.dossier.substring(procedurestap.dossier.lastIndexOf('/') + 1) : undefined;
          exportHTML += `<div><a target="_blank" href="https://kaleidos-test.vlaanderen.be/dossiers/${dossierId}/deeldossiers/${procedurestapId}/overzicht">Bekijk deze procedurestap op kaleidos test omgeving</a></div>\n`;
          exportHTML += `<div><a target="_blank" href="https://kaleidos.vlaanderen.be/dossiers/${dossierId}/deeldossiers/${procedurestapId}/overzicht">Bekijk deze procedurestap op kaleidos productie omgeving</a></div>\n`;

          let themisUrl = `https://themis-test.vlaanderen.be/view/government-body?resource=${procedurestap.samenstelling.mandatarissen[0].regering}`;
          exportHTML += `<div><a target="_blank" href="${themisUrl}">Bekijk de samenstelling Vlaamse regering in Themis ten tijde van deze procedurestap</a></div>\n`;
        }
        exportHTML += `</section>`;
    }
  }
  exportHTML += `
  </body>
</html>`;
  res.type('html');
  res.send(exportHTML);
});

/* utility that helps with debugging. Returns the full url for an agendapoint, including meeting & agenda id */
app.get('/agendapunt-url', async function (req, res) {
  try {
    let baseUrl = getBaseUrl(req);
    if (req.query && req.query.agendapunt) {
      let results = await getMeetingAndAgenda(req.query.agendapunt);
      if (results && results.length > 0) {
        let resultUrls = [];
        for (const result of results) {
          if (result.meeting && result.agenda) {
            const agendapuntId = req.query.agendapunt.substring(req.query.agendapunt.lastIndexOf('/') + 1);
            const meetingId = result.meeting.substring(result.meeting.lastIndexOf('/') + 1);
            const agendaId = result.agenda.substring(result.agenda.lastIndexOf('/') + 1);
            resultUrls.push(`${baseUrl.replace(/:[^\/][0-9]*[^\/]/,'')}/vergadering/${meetingId}/agenda/${agendaId}/agendapunten/${agendapuntId}`);
          }
        }
        res.send(JSON.stringify(resultUrls));
      } else {
        res.status(404).send('not found.')
      }
    } else {
      res.status(400).send('agendapunt is a required parameter');
    }
  } catch (e) {
    res.status(500).send(e);
  }
});

/* Generates a .ttl file with all the triples that need to be added to the database */
app.get('/generatemigrationttl', async function(req, res) {
  try {
    let ttlString = `@prefix ext: <http://mu.semte.ch/vocabularies/ext/> .
@prefix mandataris: <http://themis.vlaanderen.be/id/mandataris/> .
@prefix agendapunten: <http://kanselarij.vo.data.gift/id/agendapunten/> .\n\n`;
    let mappings = await getMappings();
    // structure the data a bit different, so the turtle becomes more human-readable when we iterate over it
    let agendapunten = {};
    if (mappings && Array.isArray(mappings)) {
      for (const mapping of mappings) {
        for (const themisUrl in mapping.themisMandatarissen) {
          if (mapping.themisMandatarissen.hasOwnProperty(themisUrl)) {
            const mandataris = mapping.themisMandatarissen[themisUrl];
            for (const agendapunt of mandataris.agendapunten) {
              if (!agendapunten[agendapunt]) {
                agendapunten[agendapunt] = [];
              }
              agendapunten[agendapunt].splice(agendapunten[agendapunt].length, 0, themisUrl);
            }
          }
        }
      }
    }
    for (const agendapunt in agendapunten) {
      if (agendapunten.hasOwnProperty(agendapunt)) {
        ttlString += `${agendapunt.replace('http://kanselarij.vo.data.gift/id/agendapunten/', 'agendapunten:')} ext:heeftBevoegdeVoorAgendapunt `;
        for (const themisMandataris of agendapunten[agendapunt]) {
          ttlString += `${themisMandataris.replace('http://themis.vlaanderen.be/id/mandataris/', 'mandataris:')}, `;
        }
        ttlString += `.\n`;
      }
    }
    ttlString = ttlString.replace(/, \./g, ' .');
    await fsp.writeFile(path.resolve(TTL_EXPORT_FILE_PATH + 'agendapunten.ttl'), ttlString);
    res.send('.ttl file generated at ' + path.resolve(TTL_EXPORT_FILE_PATH + 'agendapunten.ttl'));
  } catch (e) {
    res.status(500).send(e);
  }
});

/* Generates a .sparql file with a query to remove the old mandataries and their links from the database */
app.get('/generatemigrationsparql', async function(req, res) {
  // before we can delete mandataries from the database,
  // we need to make sure there's no other triples pointing to these mandataries,
  // or that these links are at least replaced by proper new ones.
  try {
    // we need to find out which kaleidos mandataries are going to be replaced by a themis one.
    // the others remain the same
    let deprecatedMandatarissen = [];
    let mappings = await getMappings();
    if (mappings && Array.isArray(mappings)) {
      for (const mapping of mappings) {
        if (mapping.kaleidosMandataris && mapping.themisMandatarissen && Object.keys(mapping.themisMandatarissen).length > 0) {
          deprecatedMandatarissen.push(mapping.kaleidosMandataris);
        }
      }
    }
    // now get all the triples that have this mandataris as subject or object
    let triples = [];
    for (const mandataris of deprecatedMandatarissen) {
      let mandatarisTriples = await getTriplesForMandataris(mandataris);
      for (const t of mandatarisTriples) {
        triples.splice(triples.length, 0, t);
      }
    }
    await fsp.writeFile(path.resolve(SPARQL_EXPORT_FILE_PATH), JSON.stringify(triples, null, ' '));
    res.send('.sparql file generated at ' + path.resolve(SPARQL_EXPORT_FILE_PATH));
  } catch (e) {
    res.status(500).send(e);
  }
});

app.use(errorHandler);
