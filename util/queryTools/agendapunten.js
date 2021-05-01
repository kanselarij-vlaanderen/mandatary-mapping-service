import { query } from 'mu';
import { parseSparqlResults } from './parseSparqlResults';
/* Get all agenda points (83444 in test db) */
const getAgendapunten = async function (limit) {
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

    // some statistics about names
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
    return agendapunten;
  } else {
    console.log(response);
  }
};

export { getAgendapunten };
