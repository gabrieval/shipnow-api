/**
 * Formato unico de respuesta HTTP. Lo usan solo los controllers.
 * Mantener el mismo sobre `{ status, payload }` en toda la API evita que cada
 * endpoint invente su propia forma.
 */
const { HTTP_STATUS } = require('../constants');

function success(res, payload, statusCode = HTTP_STATUS.OK) {
  return res.status(statusCode).json({ status: 'success', payload });
}

function failure(res, message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, details) {
  const body = { status: 'error', message };
  if (details !== undefined) body.details = details;
  return res.status(statusCode).json(body);
}

module.exports = { success, failure };
