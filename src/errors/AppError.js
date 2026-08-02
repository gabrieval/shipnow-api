/**
 * AppError - clase base de todos los errores esperados del dominio.
 *
 * Un AppError no lleva un status ni un mensaje "a mano": lleva un `code` del
 * diccionario, y de ahi salen el status HTTP y el mensaje. Asi, el service que
 * lo lanza no decide nada de HTTP (no es su responsabilidad) y el middleware no
 * necesita conocer cada caso particular.
 */
const { getErrorDefinition, ERROR_CODES } = require('./error.dictionary');

class AppError extends Error {
  /**
   * @param {string} code codigo del diccionario de errores
   * @param {object} [options]
   * @param {string} [options.message] pisa el mensaje por defecto del diccionario
   * @param {*} [options.details] informacion extra para el cliente (campos invalidos, etc.)
   * @param {Error} [options.cause] error original, solo para el log del servidor
   */
  constructor(code = ERROR_CODES.INTERNAL_ERROR, { message, details, cause } = {}) {
    const definition = getErrorDefinition(code);
    super(message ?? definition.message);

    this.name = this.constructor.name;
    this.code = code;
    this.status = definition.status;
    this.details = details;
    this.cause = cause;
    // Marca los errores previstos por el dominio: los que no la tienen son bugs.
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  /** True si el error viene de la capa de dominio y no de un fallo inesperado. */
  static isAppError(error) {
    return error instanceof AppError;
  }

  /** Forma serializable del error, la que termina viajando al cliente. */
  toJSON() {
    const body = { code: this.code, message: this.message };
    if (this.details !== undefined) body.details = this.details;
    return body;
  }
}

module.exports = AppError;
