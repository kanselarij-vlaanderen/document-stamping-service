import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';

import { JSONAPI_JOB_TYPE } from './config';
import {
  getDocumentsFromIds,
  getDocumentsFromAgenda,
} from "./queries/stamped-document";
import {
  jobExists,
  createJob as createStampingJob,
  updateJobStatus,
  SUCCESS,
  FAIL,
  attachFileToJob,
} from "./queries/stamping-job";
import { addStampToResource, documentByIdExists, documentsByIdExist } from "./queries/document";
import { agendaByIdExists } from "./queries/agenda";
import { stampFileToBytes, stampFile } from "./lib/stamp";
import VRDocumentName from './lib/vr-document-name';
import { updateFileMetaData } from './queries/file';

app.use(bodyParser.json());

// TODO unused endpoint. this would stamp documents on download
app.get("/documents/:document_id/download", async (req, res, next) => {
  if (await documentByIdExists(req.params.document_id)) {
    const [documentToStamp] = await getDocumentsFromIds([
      req.params.document_id,
    ]);
    const srcPath = documentToStamp.physFile.replace(/^share:\/\//, "/share/");
    const documentName = new VRDocumentName(documentToStamp.name);
    const pdfBytes = await stampFileToBytes(
      srcPath,
      documentName.vrNumberWithSuffix()
    );
    res
      .attachment(`${documentName.toString()}.pdf`)
      .send(Buffer.from(pdfBytes));
  } else {
    res.status(404).send({
      errors: [
        {
          detail: `Object of type 'documents' with id '${req.params.document_id}' doesn't exist.`,
        },
      ],
    });
  }
});

// TODO unused endpoint
app.post(
  "/documents/:document_id/stamp",
  async (req, res, next) => {
    if (await documentByIdExists(req.params.document_id)) {
      req.documentsToStamp = await getDocumentsFromIds([
        req.params.document_id,
      ]);
      next();
    } else {
      res.status(404).send({
        errors: [
          {
            detail: `Object of type 'documents' with id '${req.params.document_id}' doesn't exist.`,
          },
        ],
      });
    }
  },
  createJob,
  authorize,
  sendJob,
  runJob
);

app.post(
  "/documents/stamp",
  async (req, res, next) => {
    const { documentIds } = req.body;
    console.log(`documentIds: ${documentIds}`);
    if (!documentIds) {
      return res.status(400).send("`documentIds` required in request body");
    }
    if (
      !(documentIds instanceof Array) ||
      !documentIds.every((x) => typeof x === "string")
    ) {
      return res
        .status(400)
        .send(`documentIds needs to be an array of strings`);
    }
    if (await documentsByIdExist(documentIds)) {
      req.documentsToStamp = await getDocumentsFromIds(documentIds);
      next();
    } else {
      res.status(404).send({
        errors: [
          {
            detail: `Object of type 'documents' with id '${req.params.document_id}' doesn't exist.`,
          },
        ],
      });
    }
  },
  createJob,
  authorize,
  sendJob,
  runJob
);

app.post(
  "/agendas/:agenda_id/agendaitems/documents/stamp",
  async (req, res, next) => {
    if (await agendaByIdExists(req.params.agenda_id)) {
      req.documentsToStamp = await getDocumentsFromAgenda(req.params.agenda_id, true);
      next();
    } else {
      res.status(404).send({
        errors: [
          {
            detail: `Object of type 'agendas' with id '${req.params.agenda_id}' doesn't exist.`,
          },
        ],
      });
    }
  },
  createJob,
  authorize,
  sendJob,
  runJob
);

async function createJob(req, res, next) {
  if (req.documentsToStamp.length > 0) {
    res.job = await createStampingJob();
    next();
  } else {
    res.send(
      JSON.stringify({
        message:
          "Er zijn geen nieuwe documenten om te stempelen voor deze agenda.",
      })
    );
  }
}

async function authorize(req, res, next) {
  const authorized = await jobExists(res.job.uri);
  if (authorized) {
    next();
  } else {
    res.status(403).send({
      errors: [
        {
          detail:
            "You don't have the required access rights to stamp documents",
        },
      ],
    });
  }
}

async function sendJob(req, res, next) {
  let payload = {};
  let message;
  if (req.documentsToStamp.length === 1) {
    message = "1 nieuw document wordt gestempeld";
  } else {
    message = `${req.documentsToStamp.length} nieuwe documenten worden gestempeld.`;
  }
  payload = {
    message: message,
    job: {
      type: JSONAPI_JOB_TYPE,
      id: res.job.id,
      attributes: {
        uri: res.job.uri,
        status: res.job.status,
        created: res.job.created,
      },
    },
  };
  res.send(JSON.stringify(payload));
  next();
}

async function runJob(req, res, next) {
  try {
    for (const doc of req.documentsToStamp) {
      const filePath = doc.physFile.replace(/^share:\/\//, "/share/");
      const stampContent = new VRDocumentName(doc.name).vrNumberWithSuffix();
      await stampFile(
        filePath,
        stampContent,
        filePath
      );
      await updateFileMetaData(doc.file.uri, filePath);
      await addStampToResource(doc.id, stampContent);
      await attachFileToJob(res.job.uri, doc.file.uri, doc.file.uri);
    }
    await updateJobStatus(res.job.uri, SUCCESS);
  } catch (e) {
    console.log(e);
    await updateJobStatus(res.job.uri, FAIL, e.message);
  }
}

app.use(errorHandler);
