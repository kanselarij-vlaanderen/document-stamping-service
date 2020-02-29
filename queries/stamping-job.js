import { update, uuid as generateUuid, sparqlEscapeString, sparqlEscapeUri, sparqlEscapeDateTime } from 'mu';
import { RESOURCE_BASE } from '../config';
// import { parseSparqlResults } from './util';

// const SCHEDULED = 'scheduled';
const RUNNING = 'http://vocab.deri.ie/cogs#Running';
const SUCCESS = 'http://vocab.deri.ie/cogs#Success';
const FAIL = 'http://vocab.deri.ie/cogs#Fail';

async function createJob () {
  const uuid = generateUuid();
  const job = {
    uri: RESOURCE_BASE + `/document-stamping-jobs/${uuid}`,
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
      ${sparqlEscapeUri(job.uri)} a cogs:Job , ext:FileStampingJob ;
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
      ${escapedUri} a ext:FileStampingJob .
      OPTIONAL { ${escapedUri} ext:status ?status }
      OPTIONAL { ${escapedUri} ${sparqlEscapeUri(timePred)} ?time }
  }`;
  await update(queryString);
}

async function attachSourceFilesToJob (job, results) {
  return attachFilesToJob(job, results, 'http://www.w3.org/ns/prov#used');
}

async function attachResultFilesToJob (job, results) {
  return attachFilesToJob(job, results, 'http://www.w3.org/ns/prov#generated');
}

async function attachFilesToJob (job, files, predicate) {
  const queryString = `
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

  INSERT {
      ${sparqlEscapeUri(job)} ${sparqlEscapeUri(predicate)} ?files .
  }
  WHERE {
      ${sparqlEscapeUri(job)} a ext:FileStampingJob .
      VALUES ?files {
          ${files.map(sparqlEscapeUri).join('\n          ')}
      }
  }`;
  await update(queryString);
  return job;
}

async function attachDerivedFileToSourceFile (provenanceFileSets) {
  // provenanceFileSets is an array of objects each having 'sourceFileUri' and 'derivedFileUri'
  const queryString = `
  PREFIX prov: <http://www.w3.org/ns/prov#>
  PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>

  INSERT {
      ?source prov:wasDerivedFrom ?result .
  }
  WHERE {
      ?source a nfo:FileDataObject  .
      ?result a nfo:FileDataObject  .
      VALUES (?source ?result) {
          ${provenanceFileSets
              .map((s) => `(${sparqlEscapeUri(s.sourceFileUri)} ${sparqlEscapeUri(s.derivedFileUri)})`)
              .join('\n          ')}
      }
  }`;
  await update(queryString);
  return provenanceFileSets;
}

export {
  createJob,
  updateJobStatus,
  attachSourceFilesToJob,
  attachResultFilesToJob,
  attachDerivedFileToSourceFile,
  RUNNING, SUCCESS, FAIL
};
