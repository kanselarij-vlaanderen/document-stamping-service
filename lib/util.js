export function invert(dictionary) {
  return Object.entries(dictionary).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {});
}
