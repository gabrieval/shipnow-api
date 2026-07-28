/**
 * Manejo centralizado de errores.
 *
 * Traduce errores de Mongoose a codigos HTTP para que ningun Controller tenga
 * que conocer el driver, y respeta el status de los AppError del dominio.
 */
const { HTTP_STATUS, ERROR_MESSAGES } = require('../constants');
const { failure } = require('../utils/apiResponse');
const { config } = require('../config');

/** 404 para rutas inexistentes. */
function notFoundHandler(req, res) {
  return failure(res, `Ruta no encontrada: ${req.method} ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND);
}

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  // Errores de validacion del esquema de Mongoose.
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => e.message);
    return failure(res, 'Datos invalidos', HTTP_STATUS.UNPROCESSABLE_ENTITY, details);
  }

  // Id con formato incorrecto que igual llego al driver.
  if (err.name === 'CastError') {
    return failure(res, ERROR_MESSAGES.INVALID_ID, HTTP_STATUS.BAD_REQUEST);
  }

  // Violacion de indice unico (code/email duplicado en condicion de carrera).
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).join(', ');
    return failure(res, `Ya existe un registro con ese valor de: ${field}`, HTTP_STATUS.CONFLICT);
  }

  const status = err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;

  // Los errores no operacionales se loguean completos; al cliente le llega un mensaje generico.
  if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    console.error('[error]', err);
    return failure(
      res,
      config.isProduction ? 'Error interno del servidor' : err.message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  return failure(res, err.message, status, err.details);
}

module.exports = { errorHandler, notFoundHandler };
