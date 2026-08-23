/**
 * Configuracion de entorno.
 *
 * Este es el UNICO archivo del proyecto que puede leer `process.env`.
 * Se ejecuta al importarse: si falta una variable critica o su formato es
 * invalido, lanza un error descriptivo y la app no arranca (fail fast).
 */
const path = require('path');
const dotenv = require('dotenv');

const VALID_NODE_ENVS = ['development', 'production', 'test'];

/**
 * El entorno de testing tiene su propio archivo de variables, para no correr
 * nunca los tests contra la base de desarrollo. `NODE_ENV` se fija desde el
 * script de npm (`cross-env NODE_ENV=test`) ANTES de que se cargue el archivo:
 * por eso se puede decidir aca cual leer.
 */
const ENV_FILE = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';

dotenv.config({ path: path.resolve(__dirname, '../../', ENV_FILE) });

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
    errors.push(`- ${key}: falta definirla en el archivo ${ENV_FILE}`);
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

/**
 * Lee una variable booleana. Admite `true`/`false` en cualquier combinacion de
 * mayusculas; cualquier otro valor se reporta como error en vez de asumirse.
 */
function parseBoolean(key, fallback) {
  const value = process.env[key];
  if (value === undefined || String(value).trim() === '') return fallback;

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  errors.push(`- ${key}: "${value}" no es valido. Valores admitidos: true | false`);
  return fallback;
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

// Nivel minimo de log. Por defecto depende del entorno: en produccion no se
// emiten `debug` ni `http` para no llenar el disco de ruido.
const VALID_LOG_LEVELS = ['fatal', 'error', 'warning', 'info', 'http', 'debug'];
const defaultLogLevel = nodeEnv === 'production' ? 'info' : nodeEnv === 'test' ? 'error' : 'debug';
const logLevel = optional('LOG_LEVEL', defaultLogLevel);
if (!VALID_LOG_LEVELS.includes(logLevel)) {
  errors.push(`- LOG_LEVEL: "${logLevel}" no es valido. Valores admitidos: ${VALID_LOG_LEVELS.join(' | ')}`);
}

/**
 * URL publica de la API. La usa Swagger para declarar el servidor: dentro de un
 * contenedor o detras de un proxy, "localhost" no es la direccion real.
 */
const publicUrl = optional('API_PUBLIC_URL', `http://localhost:${port ?? 8080}`);
if (!/^https?:\/\//.test(publicUrl)) {
  errors.push(`- API_PUBLIC_URL: "${publicUrl}" debe empezar con http:// o https://`);
}

/**
 * Endpoints internos (mocks y prueba del logger). Son herramientas de
 * desarrollo: en produccion quedan apagados por defecto, porque permiten
 * escribir y borrar datos en masa. Se pueden habilitar a proposito.
 */
const enableInternal = parseBoolean('ENABLE_INTERNAL_ENDPOINTS', nodeEnv !== 'production');

/**
 * Documentacion Swagger. Queda encendida por defecto tambien en produccion: es
 * de solo lectura y no expone datos, pero se puede apagar si el despliegue es
 * privado.
 */
const enableDocs = parseBoolean('ENABLE_DOCS', true);

// --- Corte del arranque si hubo problemas ----------------------------------

if (errors.length > 0) {
  throw new Error(
    [
      '',
      '[config] No se pudo iniciar ShipNow: la configuracion de entorno es invalida.',
      '',
      ...errors,
      '',
      `Solucion: copia el archivo ${ENV_FILE}.example como ${ENV_FILE} y completa los valores.`,
      `  cp ${ENV_FILE}.example ${ENV_FILE}   (Windows: copy ${ENV_FILE}.example ${ENV_FILE})`,
      '',
    ].join('\n')
  );
}

/** Objeto de configuracion ya validado. El resto de la app consume solo esto. */
const config = Object.freeze({
  envFile: ENV_FILE,
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: parsedPort,
  mongodbUri,
  defaultPageSize,
  saltRounds,
  logLevel,
  publicUrl,
  enableInternal,
  enableDocs,
});

module.exports = config;
