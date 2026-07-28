/**
 * Error de dominio con status HTTP asociado.
 *
 * Lo lanzan los Services. El Controller no interpreta errores: los pasa a
 * `next(error)` y el middleware central traduce el status y el mensaje.
 */
const { HTTP_STATUS } = require('../constants');

class AppError extends Error {
  /**
   * @param {string} message mensaje para el cliente
   * @param {number} status codigo HTTP
   * @param {object} [details] informacion extra opcional (campos invalidos, etc.)
   */
  constructor(message, status = HTTP_STATUS.INTERNAL_SERVER_ERROR, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new AppError(message, HTTP_STATUS.BAD_REQUEST, details);
  }

  static unauthorized(message) {
    return new AppError(message, HTTP_STATUS.UNAUTHORIZED);
  }

  static forbidden(message) {
    return new AppError(message, HTTP_STATUS.FORBIDDEN);
  }

  static notFound(message) {
    return new AppError(message, HTTP_STATUS.NOT_FOUND);
  }

  static conflict(message) {
    return new AppError(message, HTTP_STATUS.CONFLICT);
  }
}

module.exports = AppError;
