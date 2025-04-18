export function invert(dictionary) {
  return Object.entries(dictionary).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {});
}

export function hasDigitalSignature(form) {
  try {
    for (const field of form.getFields()) {
      if (field.constructor.name === 'PDFSignature') {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking for digital signatures:', error);
    throw new Error('Failed to check for digital signatures');
  }
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
