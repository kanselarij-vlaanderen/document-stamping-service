async function fetchCurrentUser(sessionUri) {
  // Note: mock accounts are in the http://mu.semte.ch/graphs/public graph, whereas regular accounts are in the http://mu.semte.ch/graphs/system/users graph.
  const userQuery = `
${prefixHeaderLines.foaf}
${prefixHeaderLines.session}

SELECT DISTINCT ?uri ?firstName ?familyName ?mbox WHERE {
  GRAPH ${escapedGraphs.sessions} {
    ${sparqlEscapeUri(sessionUri)} session:account ?account
  }
  VALUES ?g { <http://mu.semte.ch/graphs/public> <http://mu.semte.ch/graphs/system/users> }
  GRAPH ?g {
    ?uri foaf:account ?account ;
          foaf:firstName ?firstName ;
          foaf:familyName ?familyName ;
          foaf:mbox ?mbox .
  }
}`;
  const currentUser = await query(userQuery);
  if (currentUser) {
    let parsedResults = parseSparqlResults(currentUser);
    return parsedResults?.[0];
  }
}

export {
  fetchCurrentUser
}