/**
 * Middleware global de errores: la UNICA salida de errores de toda la API.
 *
 * Ningun controller, service o ruta arma una respuesta de error. Todos lanzan
 * (o derivan con `next(error)`) y este middleware:
 *   1. Normaliza lo que sea que haya llegado a un AppError.
 *   2. Loguea segun la gravedad.
 *   3. Responde siempre con la misma estructura.
 */
const { normalizeError, RouteNotFoundError } = require('../errors');
const { failure } = require('../utils/apiResponse');
const { config } = require('../config');

/** Cualquier ruta no registrada entra al mismo circuito que el resto de los errores. */
function notFoundHandler(req, res, next) {
  return next(new RouteNotFoundError(req.method, req.originalUrl));
}

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  const error = normalizeError(err);

  // Un error operacional es un caso previsto del dominio: se loguea corto.
  // Uno no operacional es un bug: se loguea entero, con la causa original.
  if (error.isOperational) {
    if (!config.isTest) {
      console.warn(`[error] ${error.code} ${req.method} ${req.originalUrl} -> ${error.message}`);
    }
  } else {
    console.error(`[error] ${error.code} ${req.method} ${req.originalUrl}`, error.cause ?? error);
  }

  const body = error.toJSON();

  // En produccion, un fallo inesperado no filtra su mensaje interno al cliente.
  if (!error.isOperational && config.isProduction) {
    delete body.details;
    body.message = 'Error interno del servidor';
  }

  return failure(res, { ...body, path: `${req.method} ${req.originalUrl}` }, error.status);
}

module.exports = { errorHandler, notFoundHandler };
