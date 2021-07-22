import { query } from 'mu';
import { parseSparqlResults } from './parseSparqlResults';
import { promises as fsp } from 'fs';
import * as path from 'path';

const FILE_PATH = '/data/publicatieaangelegenheden.json';

/* Get all procedure steps.
This writes a json file to the /data folder on the first execution, since this is a very heave query.
All subsequent requests will be answered by reading this file, unless forceQuery is truthy.
*/
const getPublicatieaangelegenheden = async function (limit, forceQuery) {
  let localFile;
  // the following could cache the data of this heavy query, but the file gets destroyed after every docker reboot...
  let filePath = path.resolve(FILE_PATH);
  try {
    localFile = await fsp.readFile(filePath);
  } catch (e) {
    console.log('No local file with agendapoints found at ' + filePath);
    console.log('Executing agendapoints query...');
  }
  let publicatieaangelegenheden;
  if (forceQuery || !localFile) {
    const listQuery = `
    PREFIX mandaat: <http://data.vlaanderen.be/ns/mandaat#>
    PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
    PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
    PREFIX publicatie: <http://mu.semte.ch/vocabularies/ext/publicatie/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    SELECT DISTINCT ?publicatieaangelegenheid ?created ?modified ?mandataris ?dossier WHERE {
      GRAPH <http://mu.semte.ch/graphs/organizations/kanselarij> {
        ?mandataris a mandaat:Mandataris .
        ?publicatieaangelegenheid ext:heeftBevoegdeVoorPublicatie ?mandataris .
        ?publicatieaangelegenheid a publicatie:Publicatieaangelegenheid .
        OPTIONAL { ?publicatieaangelegenheid dct:created ?created } .
        OPTIONAL { ?publicatieaangelegenheid dct:modified ?modified } .
        OPTIONAL { ?publicatieaangelegenheid dossier:behandelt ?dossier } .
      }
    } ${limit ? 'LIMIT ' + limit : ''}`;
    let response = await query(listQuery);
    publicatieaangelegenheden = parseSparqlResults(response);
    // if (publicatieaangelegenheden) {
    //   // store this response for later use
    //   if (!localFile) {
    //     console.log('Writing publicatieaangelegenheden to ' + filePath);
    //     await fsp.writeFile(filePath, JSON.stringify(publicatieaangelegenheden));
    //   }
    // } else {
    //   console.log(response);
    // }
  } else if (localFile) {
    console.log('Local file with publicatieaangelegenheden found at ' + filePath);
    publicatieaangelegenheden = JSON.parse(localFile);
  }
  //print some stats
  if (publicatieaangelegenheden) {
    let groupedPublicatieaangelegenheden = {};
    let groupedMandataries = {};

    // some statistics for the log
    for (const publicatieaangelegenheid of publicatieaangelegenheden) {
      if (publicatieaangelegenheid.publicatieaangelegenheid) {
        if (!groupedPublicatieaangelegenheden[publicatieaangelegenheid.publicatieaangelegenheid]) {
          groupedPublicatieaangelegenheden[publicatieaangelegenheid.publicatieaangelegenheid] = [];
        }
        groupedPublicatieaangelegenheden[publicatieaangelegenheid.publicatieaangelegenheid].push(publicatieaangelegenheid);
      }
      if (publicatieaangelegenheid.mandataris) {
        if (!groupedMandataries[publicatieaangelegenheid.mandataris]) {
          groupedMandataries[publicatieaangelegenheid.mandataris] = [];
        }
        groupedMandataries[publicatieaangelegenheid.mandataris].push(publicatieaangelegenheid.mandataris);
      }
    }
    console.log(`Total: ${publicatieaangelegenheden.length} publicatieaangelegenheden, ${Object.keys(groupedPublicatieaangelegenheden).length} unique ones, referencing unique mandataries: ${Object.keys(groupedMandataries).length}`);
  }
  return publicatieaangelegenheden;
};

export { getPublicatieaangelegenheden };
