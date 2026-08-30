/**
 * Barrel de la capa de configuracion.
 *
 * Permite `require('./config')` desde cualquier punto de la app y deja en un
 * solo lugar la relacion entre configuracion validada, conexion a la base y
 * logger.
 */
const config = require('./env.config');
const { connectDB, disconnectDB, getConnectionState } = require('./db.config');
const { logger, LEVELS, LOGS_DIR, logLoggerSetup } = require('./logger.config');

module.exports = {
  config,
  connectDB,
  disconnectDB,
  getConnectionState,
  logger,
  LEVELS,
  LOGS_DIR,
  logLoggerSetup,
};
