/**
 * Formato unico de respuesta HTTP.
 *
 * `success` lo usan los controllers; `failure` lo usa EXCLUSIVAMENTE el
 * middleware global de errores. Mantener las dos formas en un solo archivo es
 * lo que garantiza que toda la API responda igual.
 *
 * Exito:  { status: 'success', payload: {...} }
 * Error:  { status: 'error', error: { code, message, details? }, timestamp, path }
 */
const { HTTP_STATUS } = require('../constants');

function success(res, payload, statusCode = HTTP_STATUS.OK) {
  return res.status(statusCode).json({ status: 'success', payload });
}

/**
 * @param {object} res
 * @param {{code: string, message: string, details?: *, path: string}} error
 * @param {number} statusCode
 */
function failure(res, { code, message, details, path }, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR) {
  const body = {
    status: 'error',
    error: { code, message },
    timestamp: new Date().toISOString(),
    path,
  };

  if (details !== undefined) body.error.details = details;

  return res.status(statusCode).json(body);
}

module.exports = { success, failure };
