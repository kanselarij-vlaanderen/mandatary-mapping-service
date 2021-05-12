import { app, errorHandler } from 'mu';
import themisData from './util/themisData';
import kaleidosData from './util/kaleidosData';
import jsonParser from './util/jsonParser';

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

// useful query to gain insight: http://localhost:8888/matchings?limit=1000&sortBy=themisMandataris.score&order=asc
app.get('/matchings', async function(req, res) {
  let matchings = await kaleidosData.getAgendapuntMatches(req.query.includeSamenstelling);
  if (req.query && req.query.sortBy) {
    let order = req.query.order;
    if (order !== 'asc' && order !== 'desc') {
      order = 'asc';
    }
    if (!matchings.agendapunten) {
      return res.send('Query not finished yet. Try again later.');
    }
    matchings.agendapunten.sort((a, b) => {
      const aProp = jsonParser.getPropertyByPath(a, req.query.sortBy);
      const bProp = jsonParser.getPropertyByPath(b, req.query.sortBy);
      if (aProp !== undefined && bProp !== undefined) {
        if (aProp > bProp) {
          return order === 'asc' ? 1 : -1;
        } else if (aProp < bProp) {
          return order === 'asc' ? -1 : 1;
        }
      }
      return 0;
    });
  }
  if (req.query && +req.query.limit) {
    matchings.agendapunten = matchings.agendapunten.slice(0, +req.query.limit);
  }
  res.send(matchings);
});

app.get('/missingthemismandataris', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten();
  let filtered = agendapunten.filter((agendapunt) => { return !agendapunt.themisMandataris });
  res.send(JSON.stringify(filtered));
});

app.get('/missingsamenstelling', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten();
  let filtered = agendapunten.filter((agendapunt) => { return !agendapunt.samenstelling });
  res.send(JSON.stringify(filtered));
});

// returns missing dates for government compositions. Returns an empty array, was used for debugging
app.get('/missingdates', async function(req, res) {
  let agendapunten = await kaleidosData.getAgendapunten();
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

app.use(errorHandler);
