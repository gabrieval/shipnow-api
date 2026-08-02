/**
 * Normalizador de errores.
 *
 * Traduce cualquier cosa que llegue al middleware a un AppError. Aca vive el
 * unico lugar del proyecto que sabe como se ven los errores de Mongoose: asi el
 * middleware queda generico y los services nunca tienen que atrapar errores del
 * driver para reescribirlos.
 */
const AppError = require('./AppError');
const { ERROR_CODES } = require('./error.dictionary');

/** Errores de validacion de esquema de Mongoose -> lista de campos invalidos. */
function fromValidationError(error) {
  const details = Object.values(error.errors ?? {}).map((fieldError) => ({
    field: fieldError.path,
    message: fieldError.message,
  }));

  return new AppError(ERROR_CODES.SCHEMA_VALIDATION_ERROR, { details });
}

/** Id con formato invalido que llego hasta el driver. */
function fromCastError(error) {
  return new AppError(ERROR_CODES.INVALID_ID, {
    details: { field: error.path, received: error.value },
  });
}

/** Violacion de indice unico (code 11000), incluida la version masiva de insertMany. */
function fromDuplicatedKeyError(error) {
  const keyPattern = error.keyPattern ?? error.writeErrors?.[0]?.err?.keyPattern ?? {};
  const fields = Object.keys(keyPattern);

  return new AppError(ERROR_CODES.DUPLICATED_KEY, {
    message: fields.length > 0 ? `Ya existe un registro con ese valor de: ${fields.join(', ')}` : undefined,
    details: { fields },
    cause: error,
  });
}

/** True si el error trae una violacion de clave unica, suelta o dentro de un bulk. */
function isDuplicatedKeyError(error) {
  return error.code === 11000 || error.writeErrors?.some((writeError) => writeError.err?.code === 11000);
}

/**
 * Convierte cualquier error en un AppError.
 * @param {Error} error
 * @returns {AppError}
 */
function normalizeError(error) {
  if (AppError.isAppError(error)) return error;

  if (error.name === 'ValidationError') return fromValidationError(error);
  if (error.name === 'CastError') return fromCastError(error);
  if (isDuplicatedKeyError(error)) return fromDuplicatedKeyError(error);

  // Cualquier otra cosa es un fallo no previsto: se envuelve sin exponer el detalle.
  const unexpected = new AppError(ERROR_CODES.INTERNAL_ERROR, { cause: error });
  unexpected.isOperational = false;
  return unexpected;
}

module.exports = { normalizeError, isDuplicatedKeyError };
