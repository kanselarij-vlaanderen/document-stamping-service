import { sparqlEscapeDateTime } from "mu";

export async function updateModifiedTimestamp(pieceUri, userUri) {
  const now = new Date();
  const escapedPiece = sparqlEscapeUri(pieceUri);
  const updateQuery = `
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

  DELETE {
    ${escapedPiece} dct:modified ?modified .
    ${escapedPiece} ext:modifiedBy ?modifiedBy .
  }
  INSERT {
    ${escapedPiece} dct:modified ${sparqlEscapeDateTime(now)} . 
    ${escapedPiece} ext:modifiedBy ${sparqlEscapeUri(userUri)} .
  }
  WHERE {
    ${escapedPiece} dct:modified ?modified .
    OPTIONAL { ${escapedPiece} ext:modifiedBy ?modifiedBy . }
  }
  `;

  await update(updateQuery);
}
