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

/**
 * A wrapper for route handlers and/or middlewares to handle bubbled up exceptions
 * 
 * Currently, the base template uses Express v4.17 (https://github.com/mu-semtech/mu-javascript-template/blob/v1.8.0/package.json#L23)
 * In Express v4, asynchronous route handles and middleware require you to explicitly handle
 * errors by passing them to next().
 * 
 * Because this service breaks up the logic into multiple functions that it then re-uses, we
 * would have to wrap every function in a try-catch block to handle errors. Instead, we
 * abstract it into a wrapper.
 * 
 * Upgrading to Express v5 should make this wrapper superfluous.
 * 
 * See this link https://expressjs.com/en/guide/error-handling.html for more info on
 * Express' error handling.
 * 
 * @param {Function} middleware 
 * @returns 
 */
function errorHandlingWrapper(middleware) {
  return (req, res, next) => {
    const promise = middleware(req, res, next);
    if (promise.catch) {
      promise.catch((error) => {
        console.trace(error);
        return next({
          message: `Something went wrong during the stamping process: ${error.message}`,
          status: 500,
        });
      });
    }
  };
}

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
  errorHandlingWrapper(async (req, res, next) => {
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
  }),
  errorHandlingWrapper(createJob),
  errorHandlingWrapper(authorize),
  errorHandlingWrapper(sendJob),
  errorHandlingWrapper(runJob)
);

app.post(
  "/agendas/:agenda_id/agendaitems/documents/stamp",
  errorHandlingWrapper(async (req, res, next) => {
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
  }),
  errorHandlingWrapper(createJob),
  errorHandlingWrapper(authorize),
  errorHandlingWrapper(sendJob),
  errorHandlingWrapper(runJob)
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
  let shouldFail;
  const failedDocs = [];
  try {
    for (const doc of req.documentsToStamp) {
      const filePath = doc.physFile.replace(/^share:\/\//, "/share/");
      const stampContent = new VRDocumentName(doc.name).vrNumberWithSuffix();
      try {
        await stampFile(
          filePath,
          stampContent,
          filePath
        );
        await updateFileMetaData(doc.file.uri, filePath);
        await addStampToResource(doc.id, stampContent);
        await attachFileToJob(res.job.uri, doc.file.uri, doc.file.uri);
      } catch (error) {
        console.log("An error occured when trying to stamp " + stampContent);
        console.log(error);
        failedDocs.push(stampContent);
        shouldFail = true;
      }
    }
    if (shouldFail) {
      throw new Error("One or more documents were not stamped");
    }
    await updateJobStatus(res.job.uri, SUCCESS);
  } catch (e) {
    console.log(e);
    console.log(failedDocs?.join('\n'));
    await updateJobStatus(res.job.uri, FAIL, `${e.message}: ${failedDocs?.join(', ')}`);
  }
}

app.use(errorHandler);
