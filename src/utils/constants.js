/**
 * Alias de compatibilidad.
 *
 * La consigna nombra el diccionario de constantes en dos lugares distintos
 * (`src/utils/constants.js` y `src/constants/index.js`). La implementacion real
 * vive en `src/constants/index.js`; este archivo solo reexporta para que ambas
 * rutas de import funcionen y no existan dos fuentes de verdad.
 */
module.exports = require('../constants');
