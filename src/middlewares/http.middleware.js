/**
 * Registro de peticiones HTTP.
 *
 * Reemplaza a morgan: en vez de escribir directo a stdout con su propio formato,
 * cada request entra al mismo logger que el resto de la app, con nivel `http`.
 * Asi todo el historial queda en un solo lugar y con un unico formato.
 *
 * Se loguea al terminar la respuesta (evento `finish`), que es cuando ya se
 * conoce el status y cuanto tardo.
 */
const { logger } = require('../config');

function httpLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode}`, {
      status: res.statusCode,
      duracionMs: Number(durationMs.toFixed(2)),
      rol: req.requester?.role,
    });
  });

  next();
}

module.exports = httpLogger;
