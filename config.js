// RESOURCE_BASE, MU_APPLICATION_FILE_STORAGE_PATH and STORAGE_PATH are currently unused
// we only replace the physical file on disk and keep the existing uri's and id's
// stamped files are not moved to a different folder even if a different storage path was set
const RESOURCE_BASE = 'http://mu.semte.ch/services/document-stamping-service';
const MU_APPLICATION_FILE_STORAGE_PATH = '';
const STORAGE_PATH = `/share/${MU_APPLICATION_FILE_STORAGE_PATH}`;

const JSONAPI_JOB_TYPE = 'document-stamping-jobs';
const RDF_JOB_TYPE = 'http://mu.semte.ch/vocabularies/ext/FileStampingJob';
const INTERN_SECRETARIE = 'http://themis.vlaanderen.be/id/concept/toegangsniveau/66804c35-4652-4ff4-b927-16982a3b6de8';

export {
  RESOURCE_BASE,
  STORAGE_PATH,
  JSONAPI_JOB_TYPE,
  RDF_JOB_TYPE,
  INTERN_SECRETARIE,
};
