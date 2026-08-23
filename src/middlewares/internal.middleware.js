/**
 * Puerta de los endpoints internos.
 *
 * Los mocks y la prueba del logger son herramientas de desarrollo: el primero
 * permite escribir y borrar datos en masa, el segundo existe solo para verificar
 * la configuracion de logs. Ninguno es funcionalidad de negocio.
 *
 * CRITERIO APLICADO: quedan deshabilitados en produccion por defecto. Se pueden
 * habilitar a proposito con `ENABLE_INTERNAL_ENDPOINTS=true`, por ejemplo en un
 * entorno de staging. En desarrollo y testing estan siempre activos.
 *
 * Cuando estan apagados la API responde 404 (`ROUTE_NOT_FOUND`), no 403: desde
 * afuera la ruta simplemente no existe, y no se revela que hay algo detras.
 */
const { config, logger } = require('../config');
const { RouteNotFoundError } = require('../errors');

/**
 * Construye el middleware con la bandera recibida.
 *
 * Se expone como fabrica para poder probar las dos ramas: el objeto `config`
 * esta congelado a proposito, asi que no se puede alterar en un test.
 *
 * @param {boolean} enabled si los endpoints internos estan habilitados
 */
function buildInternalOnly(enabled) {
  return function internalOnly(req, res, next) {
    if (enabled) return next();

    logger.warning('Intento de acceso a un endpoint interno deshabilitado', {
      metodo: req.method,
      ruta: req.originalUrl,
    });

    return next(new RouteNotFoundError(req.method, req.originalUrl));
  };
}

/** Middleware ya configurado con el entorno actual. Es el que usan los routers. */
const internalOnly = buildInternalOnly(config.enableInternal);

module.exports = internalOnly;
module.exports.buildInternalOnly = buildInternalOnly;
