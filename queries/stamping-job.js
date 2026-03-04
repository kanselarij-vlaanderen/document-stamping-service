import {
  query, update, uuid as generateUuid,
  sparqlEscapeString, sparqlEscapeUri, sparqlEscapeDateTime
} from 'mu';
import { JOB, RESOURCE_BASE } from '../config';

async function jobExists (uri) {
  const queryString = `
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  ASK {
      ${sparqlEscapeUri(uri)} a ${sparqlEscapeUri(JOB.RDF_TYPE)} ;
          mu:uuid ?uuid .
  }`;
  const results = await query(queryString);
  return results.boolean;
}

async function createJob () {
  const uuid = generateUuid();
  const job = {
    uri: RESOURCE_BASE + `/${JOB.JSONAPI_JOB_TYPE}/${uuid}`,
    id: uuid,
    status: JOB.STATUSES.BUSY,
    created: new Date()
  };
  const queryString = `
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX adms: <http://www.w3.org/ns/adms#>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX cogs: <http://vocab.deri.ie/cogs#>
  PREFIX prov: <http://www.w3.org/ns/prov#>

  INSERT DATA {
      ${sparqlEscapeUri(job.uri)} a cogs:Job , ${sparqlEscapeUri(JOB.RDF_TYPE)} ;
          mu:uuid ${sparqlEscapeString(job.id)} ;
          adms:status ${sparqlEscapeString(job.status)} ;
          prov:startedAtTime ${sparqlEscapeDateTime(job.created)} ;
          dct:created ${sparqlEscapeDateTime(job.created)} .
  }`;
  await update(queryString);
  return job;
}

async function updateJobStatus (uri, status, errorMessage) {
  const time = new Date();
  let timePred;
  if (status === JOB.STATUSES.SUCCESS || status === JOB.STATUSES.FAILED) { // final statusses
    timePred = 'http://www.w3.org/ns/prov#endedAtTime';
  } else {
    timePred = 'http://www.w3.org/ns/prov#startedAtTime';
  }
  const escapedUri = sparqlEscapeUri(uri);
  const queryString = `
  PREFIX adms: <http://www.w3.org/ns/adms#>
  PREFIX cogs: <http://vocab.deri.ie/cogs#>
  PREFIX schema: <http://schema.org/>

  DELETE {
      ${escapedUri} adms:status ?status ;
          ${sparqlEscapeUri(timePred)} ?time .
  }
  INSERT {
      ${escapedUri} adms:status ${sparqlEscapeUri(status)} ;
          ${
            errorMessage
              ? `schema:error ${sparqlEscapeString(errorMessage)} ;`
              : ""
          }
          ${sparqlEscapeUri(timePred)} ${sparqlEscapeDateTime(time)} .
  }
  WHERE {
      ${escapedUri} a ${sparqlEscapeUri(JOB.RDF_TYPE)} .
      OPTIONAL { ${escapedUri} adms:status ?status }
      OPTIONAL { ${escapedUri} ${sparqlEscapeUri(timePred)} ?time }
  }`;
  await update(queryString);
}

async function attachFileToJob (job, sourceFile, resultFile) {
  const queryString = `
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
  PREFIX prov: <http://www.w3.org/ns/prov#>

  INSERT {
      ${sparqlEscapeUri(job)} prov:used ${sparqlEscapeUri(sourceFile)} .
      ${sparqlEscapeUri(job)} prov:generated ${sparqlEscapeUri(resultFile)} .
  }
  WHERE {
      ${sparqlEscapeUri(job)} a ${sparqlEscapeUri(JOB.RDF_TYPE)} .
      ${sparqlEscapeUri(sourceFile)} a nfo:FileDataObject .
      ${sparqlEscapeUri(resultFile)} a nfo:FileDataObject .
  }`;
  await update(queryString);
  return job;
}

export {
  jobExists,
  createJob,
  updateJobStatus,
  attachFileToJob,
};
