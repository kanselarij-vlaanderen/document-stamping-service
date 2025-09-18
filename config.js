// RESOURCE_BASE, MU_APPLICATION_FILE_STORAGE_PATH and STORAGE_PATH are currently unused
// we only replace the physical file on disk and keep the existing uri's and id's
// stamped files are not moved to a different folder even if a different storage path was set
const RESOURCE_BASE = 'http://mu.semte.ch/services/document-stamping-service';
const MU_APPLICATION_FILE_STORAGE_PATH = '';
const STORAGE_PATH = `/share/${MU_APPLICATION_FILE_STORAGE_PATH}`;
const GRAPH = process.env.MU_APPLICATION_GRAPH || 'http://mu.semte.ch/application';

const INTERN_SECRETARIE = 'http://themis.vlaanderen.be/id/concept/toegangsniveau/66804c35-4652-4ff4-b927-16982a3b6de8';
const JOB = {
  STATUSES: {
    BUSY: 'http://redpencil.data.gift/id/concept/JobStatus/busy',
    SUCCESS: 'http://redpencil.data.gift/id/concept/JobStatus/success',
    FAILED: 'http://redpencil.data.gift/id/concept/JobStatus/failed',
  },
  RDF_TYPE: 'http://mu.semte.ch/vocabularies/ext/FileStampingJob',
  JSONAPI_JOB_TYPE: 'document-stamping-jobs',
};

export {
  RESOURCE_BASE,
  STORAGE_PATH,
  GRAPH,
  INTERN_SECRETARIE,
  JOB,
};
