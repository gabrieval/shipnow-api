/**
 * Configuracion de entorno.
 *
 * Este es el UNICO archivo del proyecto que puede leer `process.env`.
 * Se ejecuta al importarse: si falta una variable critica o su formato es
 * invalido, lanza un error descriptivo y la app no arranca (fail fast).
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VALID_NODE_ENVS = ['development', 'production', 'test'];

/** Acumula todos los problemas encontrados para reportarlos juntos. */
const errors = [];

/**
 * Devuelve el valor de una variable requerida o registra el error.
 * @param {string} key nombre de la variable de entorno
 * @returns {string|undefined}
 */
function required(key) {
  const value = process.env[key];

  if (value === undefined || String(value).trim() === '') {
    errors.push(`- ${key}: falta definirla en el archivo .env`);
    return undefined;
  }

  return String(value).trim();
}

/**
 * Devuelve el valor de una variable opcional o su valor por defecto.
 * @param {string} key nombre de la variable de entorno
 * @param {string|number} fallback valor a usar si no esta definida
 */
function optional(key, fallback) {
  const value = process.env[key];
  return value === undefined || String(value).trim() === '' ? fallback : String(value).trim();
}

// --- Lectura de las tres variables criticas -------------------------------

const nodeEnv = required('NODE_ENV');
const port = required('PORT');
const mongodbUri = required('MONGODB_URI');

// --- Validaciones de formato ----------------------------------------------

if (nodeEnv !== undefined && !VALID_NODE_ENVS.includes(nodeEnv)) {
  errors.push(`- NODE_ENV: "${nodeEnv}" no es valido. Valores admitidos: ${VALID_NODE_ENVS.join(' | ')}`);
}

const parsedPort = Number(port);
if (port !== undefined && (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535)) {
  errors.push(`- PORT: "${port}" no es un numero de puerto valido (entero entre 1 y 65535)`);
}

if (mongodbUri !== undefined && !/^mongodb(\+srv)?:\/\//.test(mongodbUri)) {
  errors.push('- MONGODB_URI: debe ser un string de conexion que empiece con mongodb:// o mongodb+srv://');
}

// --- Variables opcionales con defaults -------------------------------------

const defaultPageSize = Number(optional('DEFAULT_PAGE_SIZE', 10));
if (!Number.isInteger(defaultPageSize) || defaultPageSize <= 0) {
  errors.push(`- DEFAULT_PAGE_SIZE: "${process.env.DEFAULT_PAGE_SIZE}" debe ser un entero positivo`);
}

const saltRounds = Number(optional('BCRYPT_SALT_ROUNDS', 10));
if (!Number.isInteger(saltRounds) || saltRounds < 4 || saltRounds > 15) {
  errors.push(`- BCRYPT_SALT_ROUNDS: "${process.env.BCRYPT_SALT_ROUNDS}" debe ser un entero entre 4 y 15`);
}

// --- Corte del arranque si hubo problemas ----------------------------------

if (errors.length > 0) {
  throw new Error(
    [
      '',
      '[config] No se pudo iniciar ShipNow: la configuracion de entorno es invalida.',
      '',
      ...errors,
      '',
      'Solucion: copia el archivo .env.example como .env y completa los valores.',
      '  cp .env.example .env   (Windows: copy .env.example .env)',
      '',
    ].join('\n')
  );
}

/** Objeto de configuracion ya validado. El resto de la app consume solo esto. */
const config = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: parsedPort,
  mongodbUri,
  defaultPageSize,
  saltRounds,
});

module.exports = config;
