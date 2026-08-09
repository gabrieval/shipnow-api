/**
 * Middleware global de errores: la UNICA salida de errores de toda la API.
 *
 * Ningun controller, service o ruta arma una respuesta de error. Todos lanzan
 * (o derivan con `next(error)`) y este middleware:
 *   1. Normaliza lo que sea que haya llegado a un AppError.
 *   2. Lo registra con Winston, eligiendo el nivel segun la gravedad.
 *   3. Responde siempre con la misma estructura.
 *
 * El logger no reemplaza al manejo de errores: lo complementa. La respuesta al
 * cliente es la misma con o sin logging.
 */
const { normalizeError, RouteNotFoundError, ERROR_CODES } = require('../errors');
const { failure } = require('../utils/apiResponse');
const { config, logger } = require('../config');
const { HTTP_STATUS } = require('../constants');

/** Cualquier ruta no registrada entra al mismo circuito que el resto de los errores. */
function notFoundHandler(req, res, next) {
  return next(new RouteNotFoundError(req.method, req.originalUrl));
}

/**
 * Nivel de log segun la gravedad del error:
 *  - warning: errores esperados del negocio (4xx). Son parte del funcionamiento
 *    normal: un id que no existe o un permiso que falta no es una falla del server.
 *  - error: fallas inesperadas del servidor (5xx).
 *  - fatal: fallas de infraestructura, como quedarse sin base de datos.
 */
function resolveLogLevel(error) {
  if (error.status < HTTP_STATUS.INTERNAL_SERVER_ERROR) return 'warning';
  if (error.code === ERROR_CODES.DATABASE_ERROR) return 'fatal';
  return 'error';
}

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  const error = normalizeError(err);
  const level = resolveLogLevel(error);

  logger[level](`${error.code}: ${error.message}`, {
    metodo: req.method,
    ruta: req.originalUrl,
    status: error.status,
    rol: req.requester?.role,
    ...(error.details !== undefined ? { detalles: error.details } : {}),
    // La causa original solo va al log, nunca a la respuesta.
    ...(error.cause ? { causa: error.cause.message, stack: error.cause.stack } : {}),
  });

  const body = error.toJSON();

  // En produccion, un fallo inesperado no filtra su mensaje interno al cliente.
  if (!error.isOperational && config.isProduction) {
    delete body.details;
    body.message = 'Error interno del servidor';
  }

  return failure(res, { ...body, path: `${req.method} ${req.originalUrl}` }, error.status);
}

module.exports = { errorHandler, notFoundHandler };
