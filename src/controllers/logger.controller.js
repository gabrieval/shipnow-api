/**
 * LoggerController - endpoint interno de prueba del sistema de logs.
 *
 * No representa una funcionalidad del negocio: existe para verificar de un
 * vistazo que los seis niveles se emiten, que la consola respeta el nivel del
 * entorno y que en los archivos queda lo que tiene que quedar.
 */
const { success } = require('../utils/apiResponse');
const { config, logger, LEVELS, LOGS_DIR } = require('../config');

/** Mensaje de ejemplo por nivel, ordenados de menos a mas grave. */
const SAMPLES = [
  ['debug', 'Nivel debug: detalle fino, solo visible en desarrollo'],
  ['http', 'Nivel http: traza de una peticion entrante'],
  ['info', 'Nivel info: evento normal del negocio, como un pedido creado'],
  ['warning', 'Nivel warning: pedido #A-102 sin repartidor asignado'],
  ['error', 'Nivel error: fallo inesperado al procesar la operacion'],
  ['fatal', 'Nivel fatal: falla critica, por ejemplo la base de datos caida'],
];

function test(req, res) {
  const emitidos = SAMPLES.map(([level, message]) => {
    logger[level](message, { origen: 'GET /api/logger-test' });
    return level;
  });

  return success(res, {
    mensaje: 'Se emitio un log de cada nivel. Revisa la consola y la carpeta de logs.',
    entorno: config.nodeEnv,
    nivelesEmitidos: emitidos,
    nivelMinimoEnConsola: logger.level,
    // Recordatorio de la jerarquia: menor numero = mas grave.
    jerarquia: LEVELS,
    archivos: config.isTest
      ? 'deshabilitados en entorno de test'
      : {
          carpeta: LOGS_DIR,
          'error-YYYY-MM-DD.log': 'solo error y fatal',
          'combined-YYYY-MM-DD.log': 'desde info hacia arriba',
        },
  });
}

module.exports = { test };
