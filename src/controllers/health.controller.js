/**
 * HealthController - chequeo de vida de la API.
 *
 * Pensado para que un orquestador (Docker, un balanceador, un uptime monitor)
 * pueda preguntar "estas viva?" sin autenticarse.
 *
 * NO expone informacion sensible: ni la URI de la base, ni variables de entorno,
 * ni rutas del servidor, ni versiones de dependencias. Solo el estado, el
 * entorno, hace cuanto esta levantada y si la base responde.
 *
 * El estado de la conexion se lo pregunta a la capa de configuracion: igual que
 * el resto de los controllers, este no importa Mongoose.
 */
const { success } = require('../utils/apiResponse');
const { config, getConnectionState } = require('../config');
const { version } = require('../../package.json');

function check(req, res) {
  return success(res, {
    status: 'ok',
    environment: config.nodeEnv,
    version,
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString(),
    // Solo el estado del enlace: nunca la URI ni las credenciales.
    database: getConnectionState(),
  });
}

module.exports = { check };
