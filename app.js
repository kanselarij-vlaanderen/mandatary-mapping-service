import { app, errorHandler } from 'mu';
import themisData from './util/themisData';
import kaleidosData from './util/kaleidosData';

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

app.get('/matchings', async function(req, res) {
  let doubles = await kaleidosData.getAgendapuntMatches();
  res.send(doubles);
});

app.get('/agendapunten', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten();
  res.send(agendapunten);
});

app.use(errorHandler);
