/**
 * Barrel de la capa de configuracion.
 *
 * Permite `require('./config')` desde cualquier punto de la app y deja en un
 * solo lugar la relacion entre configuracion validada y conexion a la base.
 */
const config = require('./env.config');
const { connectDB, disconnectDB } = require('./db.config');

module.exports = { config, connectDB, disconnectDB };
