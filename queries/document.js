import { query, sparqlEscapeString } from 'mu';

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

export {
  documentByIdExists
};
