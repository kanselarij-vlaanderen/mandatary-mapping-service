# Mandatary mapping service

This service loops over alle agendapoints, and finds the corresponding Themis mandatary for each one, based on date and current Kaleidos mandatary information.

This is in an effort to normalize/consolidate legacy data imported from sources such as DORIS, which led to duplicate and/or incomplete mandataries with different URLs, which is the cause of issues such as KAS-990.

## Installation

The service expects a full `kaleidos-project` stack to be running, especially with the database configured and running correctly.

To run this service in your `kaleidos-project` stack, add the following to your `docker-compose.override.yml`:

```
mandatary-mapping-service:
  #image: semtech/mu-javascript-template #only for linux users
  image: semtech/mu-javascript-template:windows #only for windows users
  ports:
    - 8888:80
  environment:
    NODE_ENV: "development"
    DEV_OS: "windows" #only for windows users
  links:
    - triplestore:database
  volumes:
    - /path/to/mandatary-mapping-service/:/app/
    - /path/to/data/:/data/
```

Note that the `DEV_OS` variable is optional, to enable live reload on Windows.

Also note that the data volume is used to store a json file with the result of the query to get all agendapoints out of Kaleidos.
This is useful during development, since this is a very heavy query, which can take several minutes to execute.

### Production deploy instructions

- Adapt `docker-compose.override.yml` to include "maintenance" image for frontend.
- drc down
- drc up -d frontend
- Take a backup of the database folder (`root@kal-loebas /data/app-kaleidos-test # cp -r data/db/ data/db20211113`)
- Update server's git repo for `app-kaleidos`
- edit `docker-compose.override.yml` file to include mandatary-mapping-service
```yml
  mandatary-mapping:
    build: https://github.com/kanselarij-vlaanderen/mandatary-mapping-service.git
    ports:
      - 127.0.0.1:8888:80
    links:
      - triplestore:database
    volumes:
      - ./data/themis-mandatary-mapping-migrations:/data/
```
- at the time of writing, Themis-data needed to run the mapping-service is included in the service repo by means of a `json`-file. Make sure it is the latest data.
- `drc up -d triplestore`
- `drc up -d --build mandatary-mapping`
- watch logs and wait for initial data-loading to end
- Make notes on the current state of the DB regarding mandatary counts (public & kanselarij):
```
PREFIX mandaat: <http://data.vlaanderen.be/ns/mandaat#>

select distinct ?m where {
  GRAPH <http://mu.semte.ch/graphs/organizations/kanselarij> {
    ?m a mandaat:Mandataris
  }
}
```
- validate if the matching has gone well (not 10's missing for recent items) on http://127.0.0.1:8888/agendapunt/generateMissingReport
- save http://127.0.0.1:8888/agendapunt/generateMissingReport as well as http://127.0.0.1:8888/procedurestap/generateMissingReport for later reference, so these can be fixed manually later on. (don't overwrite previous file. Equal default filenames ...)
- `curl -g http://127.0.0.1:8888/generatemigration`
- watch logs for file generation to end
- `drc stop mandatary-mapping`
- `drc rm mandatary-mapping`

- Make sure that the timestamp of the migration-files you're creating puts these migrations in the right spot (**after** the migrations that have to run before, but **before** migrations that have to run after)
- `cp ./data/themis-mandatary-mapping-migrations/*.{sparql,ttl,graph} config/migrations`. If not, make sure to rename the checked-in migrations so they "fit around" the generated ones.
  - **before:**
  - `config/migrations/20211113000000-themis-mandatarissen-kanselarij.graph`
  - `config/migrations/20211113000000-themis-mandatarissen-kanselarij.ttl`
  - `config/migrations/20211113000001-themis-mandatarissen-public.graph`
  - `config/migrations/20211113000001-themis-mandatarissen-public.ttl`
  - **after:**
  - `config/migrations/20211113000005-migrate-old-persons-to-new-model.sparql`
  - `config/migrations/20211113000006-add-newsletter-title-for-mandatees.sparql`


- You will now run all migrations. These include the Themis dataset & cleanup after mandatary-mapping migrations. Double-check the order in which migrations will be executed. `drc up -d migrations-service`.
- watch logs for migrations to end. Retries because of large file sizes are ok.
- `drc restart triplestore` for mem clearing, checkpoint, ...
- Remove mandatary-mapping service entry from override file
- comment out frontend maintenance override
- Start search re-indexing 


## Usage
*(assuming the configuration on port 8888 as above)*

To see all matchings that were performed, visit http://localhost:8888/matchings?limit=100&sortBy=themisMandataris.score&order=asc

Use the `limit` and `sortBy` parameters to target specific parts of the data and keep the overview in the browser.

To see only the metadata/statistics, visit http://localhost:8888/matchings/meta

To get a more overseeable overview of which kaleidos mandataries were mapped to which themis mandataries, visit http://localhost:8888/mandatarismapping

To see the ground truth government compositions generated from Themis, see http://localhost:8888/regeringen

Finally, to see which agendapoints/mandatary mappings are still missing, visit http://localhost:8888/missingthemismandataris or http://localhost:8888/missingthemismandataris?includeSamenstelling=true


## Export

To generate a CSV file of the mapped mandataries, visit http://localhost:8888/generateMappingCSV

To generate a CSV file of the missing mandataries, visit http://localhost:8888/generateMissingCSV
