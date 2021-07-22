import { query } from 'mu';
import { parseSparqlResults } from './parseSparqlResults';
import { promises as fsp } from 'fs';
import * as path from 'path';

const FILE_PATH = '/data/procedurestappen.json';

/* Get all procedure steps.
This writes a json file to the /data folder on the first execution, since this is a very heave query.
All subsequent requests will be answered by reading this file, unless forceQuery is truthy.
*/
const getProcedurestappen = async function (limit, forceQuery) {
  let localFile;
  // the following could cache the data of this heavy query, but the file gets destroyed after every docker reboot...
  let filePath = path.resolve(FILE_PATH);
  try {
    localFile = await fsp.readFile(filePath);
  } catch (e) {
    console.log('No local file with agendapoints found at ' + filePath);
    console.log('Executing agendapoints query...');
  }
  let procedurestappen;
  if (forceQuery || !localFile) {
    const listQuery = `
    PREFIX mandaat: <http://data.vlaanderen.be/ns/mandaat#>
    PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
    PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
    PREFIX publicatie: <https://mu.semte.ch/vocabularies/ext/publicatie/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    SELECT DISTINCT ?procedurestap ?created ?modified ?relation ?mandataris ?titel ?alternative ?procedurestapNaam ?dossier ?besluit ?agendapunt WHERE {
      GRAPH <http://mu.semte.ch/graphs/organizations/kanselarij> {
        ?mandataris a mandaat:Mandataris .
        ?procedurestap ?relation ?mandataris .
        ?procedurestap a dossier:Procedurestap .
        OPTIONAL { ?procedurestap dct:created ?created } .
        OPTIONAL { ?procedurestap ext:modified ?modified } .
        OPTIONAL { ?procedurestap dct:title ?titel } .
        OPTIONAL { ?procedurestap dct:alternative ?alternative } .
        OPTIONAL { ?procedurestap ext:procedurestapNaam ?procedurestapNaam } .
        OPTIONAL { ?dossier dossier:doorloopt ?procedurestap } .
        OPTIONAL { ?besluit ext:beslissingVindtPlaatsTijdens ?procedurestap } .
        OPTIONAL { ?besluit besluitvorming:heeftOnderwerp ?agendapunt } .
      }
    } ${limit ? 'LIMIT ' + limit : ''}`;
    let response = await query(listQuery);
    procedurestappen = parseSparqlResults(response);
    if (procedurestappen) {
      // store this response for later use
      if (!localFile) {
        console.log('Writing proceduresteps to ' + filePath);
        await fsp.writeFile(filePath, JSON.stringify(procedurestappen));
      }
    } else {
      console.log(response);
    }
  } else if (localFile) {
    console.log('Local file with proceduresteps found at ' + filePath);
    procedurestappen = JSON.parse(localFile);
  }
  //print some stats
  if (procedurestappen) {
    let groupedProcedureSteps = {};
    let groupedMandataries = {};

    // some statistics for the log
    for (const procedurestap of procedurestappen) {
      if (procedurestap.procedurestap) {
        if (!groupedProcedureSteps[procedurestap.procedurestap]) {
          groupedProcedureSteps[procedurestap.procedurestap] = [];
        }
        groupedProcedureSteps[procedurestap.procedurestap].push(procedurestap);
      }
      if (procedurestap.mandataris) {
        if (!groupedMandataries[procedurestap.mandataris]) {
          groupedMandataries[procedurestap.mandataris] = [];
        }
        groupedMandataries[procedurestap.mandataris].push(procedurestap.mandataris);
      }
    }
    console.log(`Total: ${procedurestappen.length} procedurestappen, ${Object.keys(groupedProcedureSteps).length} unique ones, referencing unique mandataries: ${Object.keys(groupedMandataries).length}`);

    let indiener = 0;
    let heeftBevoegde = 0;
    for (const procedurestap of procedurestappen) {
      if (procedurestap.relation === 'http://mu.semte.ch/vocabularies/ext/indiener') {
        indiener++;
      }
      if (procedurestap.relation === 'http://mu.semte.ch/vocabularies/ext/heeftBevoegde') {
        heeftBevoegde++;
      }
    }
    console.log(`indiener: ${indiener} ; heeftBevoegde: ${heeftBevoegde}`);
  }
  return procedurestappen;
};

export { getProcedurestappen };
