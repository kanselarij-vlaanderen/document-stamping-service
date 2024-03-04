import { app, errorHandler } from 'mu';

import { JSONAPI_JOB_TYPE } from './config';
import { getUnstampedDocumentsFromIds, getUnstampedDocumentsFromAgenda, updateDocumentWithFile } from './queries/stamped-document';
import {
  jobExists, createJob as createStampingJob, updateJobStatus, SUCCESS, FAIL,
  attachFilesToJob
} from './queries/stamping-job';
import { documentByIdExists } from './queries/document';
import { agendaByIdExists } from './queries/agenda';
import { stampMuFile } from './lib/stamp';

app.post('/documents/:document_id/stamp',
  async (req, res, next) => {
    if (await documentByIdExists(req.params.document_id)) {
      req.documentsToStamp = await getUnstampedDocumentsFromIds([req.params.document_id]);
      next();
    } else {
      res.status(404).send({
        errors: [{
          detail: `Object of type 'documents' with id '${req.params.document_id}' doesn't exist.`
        }]
      });
    }
  },
  createJob,
  authorize,
  sendJob,
  runJob
);

app.post('/agendas/:agenda_id/agendaitems/documents/stamp',
  async (req, res, next) => {
    if (await agendaByIdExists(req.params.agenda_id)) {
      req.documentsToStamp = await getUnstampedDocumentsFromAgenda(req.params.agenda_id);
      next();
    } else {
      res.status(404).send({
        errors: [{
          detail: `Object of type 'agendas' with id '${req.params.agenda_id}' doesn't exist.`
        }]
      });
    }
  },
  createJob,
  authorize,
  sendJob,
  runJob
);

async function createJob (req, res, next) {
  if (req.documentsToStamp.length > 0) {
    res.job = await createStampingJob();
    next();
  } else {
    res.status(404).send({
      errors: [{
        detail: 'No documents found to be stamped. The documents requested to be stamped may already have been stamped.'
      }]
    });
  }
}

async function authorize (req, res, next) {
  const authorized = await jobExists(res.job.uri);
  if (authorized) {
    next();
  } else {
    res.status(403).send({
      errors: [{
        detail: "You don't have the required access rights to stamp documents"
      }]
    });
  }
}

async function sendJob (req, res, next) {
  const payload = {};
  payload.data = {
    type: JSONAPI_JOB_TYPE,
    id: res.job.id,
    attributes: {
      uri: res.job.uri,
      status: res.job.status,
      created: res.job.created
    }
  };
  res.send(payload);
  next();
}

async function runJob (req, res, next) {
  try {
    for (const doc of req.documentsToStamp) {
      const stampedFile = await stampMuFile(doc.file.name, doc.physFile, doc.name);
      await attachFilesToJob(res.job.uri, doc.file.uri, stampedFile.uri);
      await updateDocumentWithFile(doc.uri, doc.file.uri, stampedFile.uri);
    }
    await updateJobStatus(res.job.uri, SUCCESS);
  } catch (e) {
    console.log(e);
    await updateJobStatus(res.job.uri, FAIL);
  }
}

app.use(errorHandler);
