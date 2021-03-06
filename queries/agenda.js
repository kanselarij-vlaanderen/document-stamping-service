import { query, sparqlEscapeString } from 'mu';

async function agendaByIdExists (id) {
  const queryString = `
  PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>

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
