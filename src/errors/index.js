/**
 * Barrel de la capa de errores.
 *
 * Los services importan de aca (`require('../errors')`) y no necesitan saber en
 * que archivo esta definida cada clase.
 */
const AppError = require('./AppError');
const domainErrors = require('./domain.errors');
const { ERROR_DICTIONARY, ERROR_CODES, getErrorDefinition } = require('./error.dictionary');
const { normalizeError } = require('./error.normalizer');

module.exports = {
  AppError,
  ERROR_DICTIONARY,
  ERROR_CODES,
  getErrorDefinition,
  normalizeError,
  ...domainErrors,
};
