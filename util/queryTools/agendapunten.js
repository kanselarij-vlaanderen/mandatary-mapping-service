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
  let agendapunten;
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

    SELECT DISTINCT ?agendapunt ?meeting ?agenda ?geplandeStart ?agendaPuntAanmaakdatum ?agendaAanmaakdatum ?mandataris ?agendaPuntTitel ?besluit ?procedurestap WHERE {
      GRAPH <http://mu.semte.ch/graphs/organizations/kanselarij> {
        ?mandataris a mandaat:Mandataris .
        ?agendapunt a besluit:Agendapunt .
        ?agendapunt ext:heeftBevoegdeVoorAgendapunt ?mandataris .
        ?agenda dct:hasPart ?agendapunt .
        ?agenda besluitvorming:isAgendaVoor ?meeting .
        OPTIONAL { ?agendapunt besluitvorming:aanmaakdatum ?agendaPuntAanmaakdatum } .
        OPTIONAL { ?agendapunt dct:title ?agendaPuntTitel } .
        OPTIONAL { ?agenda dct:created ?agendaAanmaakdatum } .
        OPTIONAL { ?meeting besluit:geplandeStart ?geplandeStart } .
        OPTIONAL {
          ?besluit besluitvorming:heeftOnderwerp ?agendapunt .
          OPTIONAL { ?besluit ext:beslissingVindtPlaatsTijdens ?procedurestap } .
        }
      }
    } ${limit ? 'LIMIT ' + limit : ''}`;
    let response = await query(listQuery);
    agendapunten = parseSparqlResults(response);
    if (agendapunten) {
      // store this response for later use
      if (!localFile) {
        console.log('Writing agendapoints to ' + filePath);
        await fsp.writeFile(filePath, JSON.stringify(agendapunten));
      }
    } else {
      console.log(response);
    }
  } else if (localFile) {
    console.log('Local file with agendapoints found at ' + filePath);
    agendapunten = JSON.parse(localFile);
  }
  // print some stats
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
    console.log(`Total: ${agendapunten.length} agendapunten, ${Object.keys(groupedAgendaPoints).length} unique ones, referencing unique mandataries: ${Object.keys(groupedMandataries).length}`);
  }
  return agendapunten;
};

/* Gets the zitting and agenda urls for an agendapunt url */
const getMeetingAndAgenda = async function (agendapunt) {
  const getQuery = `
  PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX agendapunten: <http://kanselarij.vo.data.gift/id/agendapunten/>

  select * where {
    GRAPH <http://mu.semte.ch/graphs/organizations/kanselarij> {
          ?agenda dct:hasPart <${agendapunt}> .
          ?agenda besluitvorming:isAgendaVoor ?meeting .
        }
  }`;
  let response = await query(getQuery);
  let responseData = parseSparqlResults(response);
  return responseData;
};

export { getAgendapunten, getMeetingAndAgenda };
