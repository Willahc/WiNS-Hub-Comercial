export const isDevMode = (): boolean => {
  if (typeof process !== 'undefined' && process.env.WINS_FORCE_PROD_MODE === 'true') {
    return false;
  }
  return import.meta.env.DEV;
};
