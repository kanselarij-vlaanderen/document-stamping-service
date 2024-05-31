import fs from 'fs';
import { sparqlEscapeString, sparqlEscapeUri, sparqlEscapeInt, sparqlEscapeDateTime, update, uuid as generateUuid } from 'mu';
import { RESOURCE_BASE } from '../config';

// TODO update modified, filesize, (created stays the same)
const createFile = async function (file, physicalUri) {
  const uri = RESOURCE_BASE + `/files/${file.id}`;
  const physicalUuid = generateUuid();
  const q = `
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
  PREFIX dbpedia: <http://dbpedia.org/ontology/>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

  INSERT DATA {
      ${sparqlEscapeUri(uri)} a nfo:FileDataObject ;
            nfo:fileName ${sparqlEscapeString(file.name)} ;
            mu:uuid ${sparqlEscapeString(file.id)} ;
            dct:format ${sparqlEscapeString(file.format)} ;
            nfo:fileSize ${sparqlEscapeInt(file.size)} ;
            dbpedia:fileExtension ${sparqlEscapeString(file.extension)} ;
            dct:created ${sparqlEscapeDateTime(file.created)} ;
            dct:modified ${sparqlEscapeDateTime(file.created)} .
      ${sparqlEscapeUri(physicalUri)} a nfo:FileDataObject ;
            nie:dataSource ${sparqlEscapeUri(uri)} ;
            nfo:fileName ${sparqlEscapeString(`${physicalUuid}.${file.extension}`)} ;
            mu:uuid ${sparqlEscapeString(physicalUuid)} ;
            dct:format ${sparqlEscapeString(file.format)} ;
            nfo:fileSize ${sparqlEscapeInt(file.size)} ;
            dbpedia:fileExtension ${sparqlEscapeString(file.extension)} ;
            dct:created ${sparqlEscapeDateTime(file.created)} ;
            dct:modified ${sparqlEscapeDateTime(file.created)} .
  }`;
  await update(q);
  file.uri = uri;
  return file;
};

const updateFileMetaData = async function (fileUri, filePath) {
  const filestats = fs.statSync(filePath);
  const size = filestats.size;
  // filestats.birthtime stays the same datetime even when replacing
  const modified = new Date();
  const updateQuery = `
  PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

  DELETE {
    ${sparqlEscapeUri(fileUri)} nfo:fileSize ?size .
    ${sparqlEscapeUri(fileUri)} dct:modified ?modified .
    ?physFile nfo:fileSize ?physSize ;
        dct:modified ?physModified .
  }
  INSERT {
      ${sparqlEscapeUri(fileUri)} nfo:fileSize ${sparqlEscapeInt(size)} ;
            dct:modified ${sparqlEscapeDateTime(modified)} .
      ?physFile nfo:fileSize ${sparqlEscapeInt(size)} ;
            dct:modified ${sparqlEscapeDateTime(modified)} .
  }
  WHERE {
    ${sparqlEscapeUri(fileUri)} a nfo:FileDataObject ;
          nfo:fileSize ?size .
    OPTIONAL { ${sparqlEscapeUri(fileUri)} dct:modified ?modified . }
    ?physFile a nfo:FileDataObject ;
        nie:dataSource ${sparqlEscapeUri(fileUri)} ;
        nfo:fileSize ?physSize .
      OPTIONAL { ?physFile dct:modified ?physModified . }
  }
  `;
  await update(updateQuery);
  return;
};

export {
  createFile,
  updateFileMetaData
};
