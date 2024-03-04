export const parseSparqlResults = (data) => {
  if (!data) return;
  const vars = data.head.vars;
  return data.results.bindings.map((binding) => {
    const obj = {};
    vars.forEach((varKey) => {
      if (binding[varKey]) {
        obj[varKey] = binding[varKey].value;
      }
    });
    return obj;
  });
};

export function chunks(array, chunkSize=100) {
  if (chunkSize === 0) {
    throw new Error('Chunk size cannot be zero');
  }

  const out = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    out.push(chunk);
  }
  return out;
}