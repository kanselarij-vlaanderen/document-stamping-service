import {
  query, update, uuid as generateUuid,
  sparqlEscapeString, sparqlEscapeUri, sparqlEscapeDateTime
} from 'mu';
import { RESOURCE_BASE, RDF_JOB_TYPE, JSONAPI_JOB_TYPE } from '../config';
// import { parseSparqlResults } from './util';

// const SCHEDULED = 'scheduled';
const RUNNING = 'http://vocab.deri.ie/cogs#Running';
const SUCCESS = 'http://vocab.deri.ie/cogs#Success';
const FAIL = 'http://vocab.deri.ie/cogs#Fail';

async function jobExists (uri) {
  const queryString = `
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  ASK {
      ${sparqlEscapeUri(uri)} a ${sparqlEscapeUri(RDF_JOB_TYPE)} ;
          mu:uuid ?uuid .
  }`;
  const results = await query(queryString);
  return results.boolean;
}

async function createJob () {
  const uuid = generateUuid();
  const job = {
    uri: RESOURCE_BASE + `/${JSONAPI_JOB_TYPE}/${uuid}`,
    id: uuid,
    status: RUNNING,
    created: new Date()
  };
  const queryString = `
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX cogs: <http://vocab.deri.ie/cogs#>

  INSERT DATA {
      ${sparqlEscapeUri(job.uri)} a cogs:Job , ${sparqlEscapeUri(RDF_JOB_TYPE)} ;
          mu:uuid ${sparqlEscapeString(job.id)} ;
          ext:status ${sparqlEscapeString(job.status)} ;
          dct:created ${sparqlEscapeDateTime(job.created)} .
  }`;
  await update(queryString);
  return job;
}

async function updateJobStatus (uri, status) {
  const time = new Date();
  let timePred;
  if (status === SUCCESS || status === FAIL) { // final statusses
    timePred = 'http://www.w3.org/ns/prov#endedAtTime';
  } else {
    timePred = 'http://www.w3.org/ns/prov#startedAtTime';
  }
  const escapedUri = sparqlEscapeUri(uri);
  const queryString = `
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX cogs: <http://vocab.deri.ie/cogs#>

  DELETE {
      ${escapedUri} ext:status ?status ;
          ${sparqlEscapeUri(timePred)} ?time .
  }
  INSERT {
      ${escapedUri} ext:status ${sparqlEscapeUri(status)} ;
          ${sparqlEscapeUri(timePred)} ${sparqlEscapeDateTime(time)} .
  }
  WHERE {
      ${escapedUri} a ${sparqlEscapeUri(RDF_JOB_TYPE)} .
      OPTIONAL { ${escapedUri} ext:status ?status }
      OPTIONAL { ${escapedUri} ${sparqlEscapeUri(timePred)} ?time }
  }`;
  await update(queryString);
}

async function attachFilesToJob (job, sourceFile, resultFile) {
  const queryString = `
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
  PREFIX prov: <http://www.w3.org/ns/prov#>

  INSERT {
      ${sparqlEscapeUri(job)} prov:used ${sparqlEscapeUri(sourceFile)} .
      ${sparqlEscapeUri(job)} prov:generated ${sparqlEscapeUri(resultFile)} .
  }
  WHERE {
      ${sparqlEscapeUri(job)} a ${sparqlEscapeUri(RDF_JOB_TYPE)} .
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
  attachFilesToJob,
  RUNNING, SUCCESS, FAIL
};
