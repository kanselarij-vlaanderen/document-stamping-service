import { query, sparqlEscapeString } from 'mu';

async function agendaByIdExists (id) {
  const queryString = `
  PREFIX besluitvorming: <https://data.vlaanderen.be/ns/besluitvorming#>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

  ASK {
      ?agenda a besluitvorming:Agenda ;
          mu:uuid ${sparqlEscapeString(id)} .
  }`;
  const results = await query(queryString);
  return results.boolean;
}

export {
  agendaByIdExists
};
