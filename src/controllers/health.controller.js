/**
 * HealthController - chequeo de vida de la API.
 *
 * Pensado para que un orquestador (Docker, un balanceador, un uptime monitor)
 * pueda preguntar "estas viva?" sin autenticarse.
 *
 * NO expone informacion sensible: ni la URI de la base, ni variables de entorno,
 * ni rutas del servidor, ni versiones de dependencias. Solo el estado, el
 * entorno, hace cuanto esta levantada y si la base responde.
 */
const mongoose = require('mongoose');

const { success } = require('../utils/apiResponse');
const { config } = require('../config');
const { version } = require('../../package.json');

/** Traduce el estado numerico de la conexion de Mongoose a algo legible. */
const ESTADOS_DE_CONEXION = Object.freeze({
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
});

function check(req, res) {
  return success(res, {
    status: 'ok',
    environment: config.nodeEnv,
    version,
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString(),
    // Solo el estado del enlace: nunca la URI ni las credenciales.
    database: ESTADOS_DE_CONEXION[mongoose.connection.readyState] ?? 'unknown',
  });
}

module.exports = { check };
