import { query, sparqlEscapeString, update } from 'mu';

async function documentByIdExists (id) {
  const queryString = `
  PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

  ASK {
      ?document a dossier:Stuk ;
          mu:uuid ${sparqlEscapeString(id)} .
  }`;
  const results = await query(queryString);
  return results.boolean;
}

async function documentsByIdExist (ids) {
  const queryString = `
  PREFIX dossier: <https://data.vlaanderen.be/ns/dossier#>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

  ASK {
    VALUES ?uuid {
      ${ids.map(sparqlEscapeString).join('\n      ')}
    }
    ?document 
      a dossier:Stuk ;
      mu:uuid ?uuid .
  }`;
  const results = await query(queryString);
  return results.boolean;
}

async function addStampToResource(pieceId, stampContent) {
  const queryString = `
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

  DELETE {
    ?piece ext:stamp ?previousStamp .
  } 
  INSERT {
    ?piece ext:stamp ${sparqlEscapeString(stampContent)} .
  } 
  WHERE {
    ?piece mu:uuid ${sparqlEscapeString(pieceId)} . 
    OPTIONAL {
      ?piece ext:stamp ?previousStamp .
    }
  }
  `;

  await update(queryString);
}

export {
  documentByIdExists,
  documentsByIdExist,
  addStampToResource,
};
