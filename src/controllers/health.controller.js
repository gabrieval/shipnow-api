/**
 * HealthController - chequeo de vida de la API.
 *
 * Existe para que ni siquiera esta respuesta trivial quede armada dentro de un
 * archivo de rutas: toda salida HTTP sale de un controller y usa el mismo
 * formato de respuesta que el resto.
 */
const { success } = require('../utils/apiResponse');
const { config } = require('../config');

function check(req, res) {
  return success(res, {
    status: 'ok',
    environment: config.nodeEnv,
    uptime: Number(process.uptime().toFixed(2)),
  });
}

module.exports = { check };
