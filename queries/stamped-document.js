import { sparqlEscapeString, sparqlEscapeUri, query, update } from 'mu';
import { parseSparqlResults } from './util';
import { RDF_JOB_TYPE } from '../config';

const GRAPH = process.env.MU_APPLICATION_GRAPH || 'http://mu.semte.ch/application';
const SUCCESS = 'http://vocab.deri.ie/cogs#Success';

const notStampedFilter = `
FILTER NOT EXISTS {
  ?job 
    a ${sparqlEscapeUri(RDF_JOB_TYPE)};
    prov:used ?file ;
    ext:status ${sparqlEscapeUri(SUCCESS)} .
}
`;

const pdfFilter = 'FILTER(STRSTARTS(?fileFormat, "application/pdf") || ?fileExtension = "pdf")';

const documentsWhere = (unstamped) => `
  ?document a dossier:Stuk ;
      dct:title ?documentName ;
      mu:uuid ?documentId ;
      prov:value ?file .

  ${unstamped ? notStampedFilter : ""}

  ?file a nfo:FileDataObject ;
      mu:uuid ?fileId ;
      nfo:fileName ?fileName .
  ?physFile a nfo:FileDataObject ;
      nie:dataSource ?file .
  OPTIONAL { ?file dct:format ?fileFormat . }
  OPTIONAL { ?file dbpedia:fileExtension ?fileExtension . }
  ${pdfFilter}
`;

const getDocumentsFromIds = async (documentIds, unstamped) => {
  const queryString = `
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
PREFIX besluitvorming: <https://data.vlaanderen.be/ns/besluitvorming#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX dbpedia: <http://dbpedia.org/ontology/>
PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX cogs: <http://vocab.deri.ie/cogs#>

SELECT DISTINCT *
FROM ${sparqlEscapeUri(GRAPH)}
WHERE {
  ${documentsWhere(unstamped)}
  VALUES ?documentId {
    ${documentIds.map(sparqlEscapeString).join('\n      ')}
  }
}`;
  const result = await query(queryString);
  return parseSparqlResults(result).map(documentResultToHierarchicalObject);
};

const getDocumentsFromAgenda = async (agendaId, unstamped) => {
  const queryString = `
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
PREFIX besluitvorming: <https://data.vlaanderen.be/ns/besluitvorming#>
PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX dbpedia: <http://dbpedia.org/ontology/>
PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
PREFIX prov: <http://www.w3.org/ns/prov#>

SELECT DISTINCT *
FROM ${sparqlEscapeUri(GRAPH)}
WHERE {
    ?agenda a besluitvorming:Agenda ;
        mu:uuid ${sparqlEscapeString(agendaId)} ;
        dct:hasPart ?agendaitem .
    ?agendaitem a besluit:Agendapunt ;
        besluitvorming:geagendeerdStuk ?document .

  ${documentsWhere(unstamped)}
}`;
  const result = await query(queryString);
  return parseSparqlResults(result).map(documentResultToHierarchicalObject);
};

function documentResultToHierarchicalObject (r) {
  return {
    id: r.documentId,
    uri: r.document,
    name: r.documentName,
    file: {
      uri: r.file,
      name: r.fileName,
      format: r.fileFormat,
      extension: r.fileExtension
    },
    physFile: r.physFile
  };
}

/**
 *
 * @param {string} sourceDocumentUri
 * @param {string} sourceFileUri 
 * @param {string} derivedFileUri 
 * @returns object
 */
async function updateDocumentWithFile (sourceDocumentUri, sourceFileUri, derivedFileUri) {
  const queryString = `
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
  PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
  PREFIX prov: <http://www.w3.org/ns/prov#>

  DELETE {
      ?document ext:file ?oldFile .
  }
  INSERT {
      ?document ext:file ?newFile .
      ?newFile prov:wasDerivedFrom ?oldFile .
  }
  WHERE {
      ?document a dossier:Stuk ;
          ext:file ?oldFile .
      ?oldFile a nfo:FileDataObject .
      ?newFile a nfo:FileDataObject .
  }`.split('?document').join(sparqlEscapeUri(sourceDocumentUri)) // replaceAll
    .split('?oldFile').join(sparqlEscapeUri(sourceFileUri))
    .split('?newFile').join(sparqlEscapeUri(derivedFileUri));
  const result = await update(queryString);
  return result;
}

async function updateDocumentsWithFile (stampedFiles) {
  const queryString = `
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
  PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
  PREFIX prov: <http://www.w3.org/ns/prov#>

  DELETE {
      ?document prov:value ?oldFile .
  }
  INSERT {
      ?document prov:value ?newFile .
      ?newFile prov:wasDerivedFrom ?oldFile .
  }
  WHERE {
    VALUES (?document ?oldFile ?newFile) {
      ${stampedFiles
        .map(
          ({ document: doc, stampedFile }) =>
            `(${sparqlEscapeUri(doc.uri)} ${sparqlEscapeUri(
              doc.file.uri
            )} ${sparqlEscapeUri(stampedFile.uri)})`
        )
        .join("\n      ")}
    }
  }`;
  const result = await update(queryString);
  return result;
}

export {
  getDocumentsFromIds,
  getDocumentsFromAgenda,
  updateDocumentWithFile
};
