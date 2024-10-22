import { sparqlEscapeString, sparqlEscapeUri, query, update } from 'mu';
import { parseSparqlResults } from './util';
import { INTERN_SECRETARIE, RDF_JOB_TYPE } from '../config';

const GRAPH = process.env.MU_APPLICATION_GRAPH || 'http://mu.semte.ch/application';
// const SUCCESS = 'http://vocab.deri.ie/cogs#Success';

// no status filter for job, since jobs can fail on 1 document, the other documents will still be stamped
// the failed document will not be connected to any job and will be picked up again
const notStampedFilter = `
FILTER NOT EXISTS {
  ?job 
    a ${sparqlEscapeUri(RDF_JOB_TYPE)};
    prov:used ?file .
}
`;

const pdfFilter = 'FILTER(STRSTARTS(?fileFormat, "application/pdf") || ?fileExtension = "pdf")';

const documentsWhere = (unstamped) => `
  ?document a dossier:Stuk ;
      dct:title ?documentName ;
      mu:uuid ?documentId ;
      besluitvorming:vertrouwelijkheidsniveau ?accessLevel ;
      prov:value ?sourceFile .
    OPTIONAL { ?document prov:value/^prov:hadPrimarySource ?derivedFile .}
    BIND(COALESCE(?derivedFile, ?sourceFile) AS ?file)

    FILTER ( ?accessLevel != ${sparqlEscapeUri(INTERN_SECRETARIE)} )

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

// "documentIds" is always the id of a piece, even if we have derived pdf
// we return only pdf's files (source or derived)
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

// we return only pdf's files (source or derived)
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
  {
    ?agenda 
      a besluitvorming:Agenda ;
      mu:uuid ${sparqlEscapeString(agendaId)} ;
      dct:hasPart ?agendaitem .
    ?agendaitem 
      a besluit:Agendapunt ;
      besluitvorming:geagendeerdStuk ?document .
  }
  UNION
  {
    ?agenda 
      a besluitvorming:Agenda ;
      mu:uuid ${sparqlEscapeString(agendaId)} ;
      dct:hasPart ?agendaitem .
    ?agendaitem 
      a besluit:Agendapunt ;
      ^besluitvorming:genereertAgendapunt
        /besluitvorming:vindtPlaatsTijdens
        /ext:heeftBekrachtiging ?document .
  }

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
// unused method, would update if a new logical file was created
// however, we are replacing the fysical file and updating some metadata
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
  getDocumentsFromAgenda
};
