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
