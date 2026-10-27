export const supportsMapWebGL = () => {
  const canvas = document.createElement('canvas');

  return !!(
    canvas.getContext('webgl2') ||
    canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl')
  );
};
