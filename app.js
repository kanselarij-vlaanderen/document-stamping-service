import { app, errorHandler } from 'mu';

import { AUTHORIZED_USERGROUPS } from './config';
import { getUnstampedDocumentsFromIds, getUnstampedDocumentsFromAgenda } from './queries/stamped-document';
import {
  createJob, updateJobStatus, SUCCESS, FAIL,
  attachSourceFilesToJob, attachResultFilesToJob, attachDerivedFileToSourceFile
} from './queries/stamping-job';
import { documentByIdExists } from './queries/document';
import { agendaByIdExists } from './queries/agenda';
import { authorizedSession } from './lib/session';
import { stampMuFile } from './lib/stamp';

app.post('/documents/:document_id/stamp',
  authorize,
  async (req, res, next) => {
    if (documentByIdExists(req.params.document_id)) {
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
  sendJob,
  runJob
);

app.post('/agendas/:agenda_id/agendaitems/documents/stamp',
  authorize,
  async (req, res, next) => {
    if (agendaByIdExists(req.params.agenda_id)) {
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
  sendJob,
  runJob
);

function authorize (req, res, next) {
  const authorized = authorizedSession(JSON.parse(req.get('MU-AUTH-ALLOWED-GROUPS')), AUTHORIZED_USERGROUPS);
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
  if (req.documentsToStamp.length > 0) {
    res.job = await createJob();
    const payload = {};
    payload.data = {
      type: 'document-stamping-jobs',
      id: res.job.id,
      attributes: {
        uri: res.job.uri,
        status: res.job.status,
        created: res.job.created
      }
    };
    res.send(payload);
    next();
  } else {
    res.status(404).send({
      errors: [{
        detail: 'No documents found to be stamped'
      }]
    });
  }
}

async function runJob (req, res, next) {
  try {
    const stampingPromises = req.documentsToStamp.map(async function (doc) {
      return {
        sourceFile: doc.file.uri,
        stampedFile: (await stampMuFile(doc.file.name, doc.physFile, doc.name)).uri
      };
    });
    const stampData = await Promise.all(stampingPromises);
    await attachSourceFilesToJob(res.job.uri, stampData.map((d) => d.sourceFile));
    await attachResultFilesToJob(res.job.uri, stampData.map((d) => d.stampedFile));
    await attachDerivedFileToSourceFile(stampData.map(function (d) {
      return {
        sourceFileUri: d.sourceFile,
        derivedFileUri: d.stampedFile
      };
    }));
    await updateJobStatus(res.job.uri, SUCCESS);
  } catch (e) {
    console.log(e);
    await updateJobStatus(res.job.uri, FAIL);
  }
}

app.use(errorHandler);
