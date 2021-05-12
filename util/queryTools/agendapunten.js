import { query } from 'mu';
import { parseSparqlResults } from './parseSparqlResults';
import { promises as fsp } from 'fs';
import * as path from 'path';

const FILE_PATH = '/data/agendapunten.json';

/* Get all agenda points (83444 in test db).
This writes a json file to the /data folder on the first execution, since this is a very heave query.
All subsequent requests will be answered by reading this file, unless forceQuery is truthy.
*/
const getAgendapunten = async function (limit, forceQuery) {
  let localFile;
  // the following could cache the data of this heavy query, but the file gets destroyed after every docker reboot...
  let filePath = path.resolve(FILE_PATH);
  try {
    localFile = await fsp.readFile(filePath);
  } catch (e) {
    console.log('No local file with agendapoints found at ' + filePath);
    console.log('Executing agendapoints query...');
  }
  if (forceQuery || !localFile) {
    const listQuery = `
    PREFIX mandaat: <http://data.vlaanderen.be/ns/mandaat#>
    PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
    PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
    PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
    PREFIX publicatie: <https://mu.semte.ch/vocabularies/ext/publicatie/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX prov: <http://www.w3.org/ns/prov/>

    SELECT DISTINCT ?agendapunt ?meeting ?agenda ?geplandeStart ?agendaPuntAanmaakdatum ?agendaAanmaakdatum ?mandataris WHERE {
      GRAPH <http://mu.semte.ch/graphs/organizations/kanselarij> {
        ?mandataris a mandaat:Mandataris .
        ?agendapunt a besluit:Agendapunt .
        ?agendapunt ext:heeftBevoegdeVoorAgendapunt ?mandataris .
        OPTIONAL { ?agendapunt besluitvorming:aanmaakdatum ?agendaPuntAanmaakdatum } .
        ?agenda dct:hasPart ?agendapunt .
        OPTIONAL { ?agenda dct:created ?agendaAanmaakdatum } .
        ?agenda besluitvorming:isAgendaVoor ?meeting .
        OPTIONAL { ?meeting besluit:geplandeStart ?geplandeStart } .
      }
    } ${limit ? 'LIMIT ' + limit : ''}`;
    let response = await query(listQuery);
    let agendapunten = parseSparqlResults(response);
    if (agendapunten) {
      let groupedAgendaPoints = {};
      let groupedMandataries = {};

      // some statistics for the log
      for (const agendapunt of agendapunten) {
        if (agendapunt.agendapunt) {
          if (!groupedAgendaPoints[agendapunt.agendapunt]) {
            groupedAgendaPoints[agendapunt.agendapunt] = [];
          }
          groupedAgendaPoints[agendapunt.agendapunt].push(agendapunt);
        }
        if (agendapunt.mandataris) {
          if (!groupedMandataries[agendapunt.mandataris]) {
            groupedMandataries[agendapunt.mandataris] = [];
          }
          groupedMandataries[agendapunt.mandataris].push(agendapunt.mandataris);
        }
      }
      console.log(`Total: ${Object.keys(groupedAgendaPoints).length} agendapunten, unique mandataries: ${Object.keys(groupedMandataries).length}`);
      // store this response for later use
      if (!localFile) {
        console.log('Writing agendapoints to ' + filePath);
        await fsp.writeFile(filePath, JSON.stringify(agendapunten));
      }
      return agendapunten;
    } else {
      console.log(response);
    }
  } else if (localFile) {
    console.log('Local file with agendapoints found at ' + filePath);
    let agendapunten = JSON.parse(localFile);
    return agendapunten;
  }
};

export { getAgendapunten };
