/**
 * Configuracion centralizada del logger (Winston).
 *
 * Es el unico lugar del proyecto donde se definen niveles, formatos y destinos.
 * El resto de la app hace `const { logger } = require('../config')` y solo
 * decide QUE loguear y con que nivel, nunca COMO se ve ni donde va a parar.
 *
 * Reemplaza por completo a los `console.log` sueltos que habia antes.
 */
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');

const config = require('./env.config');

/** Carpeta donde se persisten los logs. Esta ignorada en Git. */
const LOGS_DIR = path.resolve(__dirname, '../../logs');

/**
 * Niveles del proyecto, de mas grave a menos grave.
 * En Winston, cuanto MENOR es el numero, mayor es la severidad: al fijar el
 * nivel del transporte se emite ese nivel y todos los mas graves.
 */
const LEVELS = Object.freeze({
  fatal: 0,
  error: 1,
  warning: 2,
  info: 3,
  http: 4,
  debug: 5,
});

const COLORS = Object.freeze({
  fatal: 'bold red',
  error: 'red',
  warning: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
});

winston.addColors(COLORS);

/**
 * Nivel minimo de log. Lo decide `LOG_LEVEL`, que a su vez tiene un valor por
 * defecto segun el entorno (debug en desarrollo, info en produccion, error en
 * testing). Asi se puede subir el detalle en produccion sin tocar codigo.
 */
function resolveConsoleLevel() {
  return config.logLevel;
}

/** `2026-08-01 10:12:03 [info]    Servidor escuchando... {"port":8080}` */
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    // `padEnd` alinea los mensajes aunque los niveles tengan distinto largo.
    const label = `[${level}]`.padEnd(9);
    const extra = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const trace = stack ? `\n${stack}` : '';
    return `${timestamp} ${label} ${message}${extra}${trace}`;
  })
);

/** Igual que el anterior pero con color: solo tiene sentido en la consola. */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ level: true }),
  baseFormat
);

const transports = [
  new winston.transports.Console({
    level: resolveConsoleLevel(),
    format: consoleFormat,
    // Los tests no necesitan ruido en stdout.
    silent: config.isTest,
  }),
];

// En test no se escriben archivos: ensuciarian el repo en cada corrida.
if (!config.isTest) {
  // Solo errores y fatales. Al fijar `error`, Winston incluye `fatal` (nivel 0).
  transports.push(
    new winston.transports.DailyRotateFile({
      level: 'error',
      dirname: LOGS_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '5m',
      maxFiles: '14d',
      format: baseFormat,
    })
  );

  // Historial completo desde `info`, para reconstruir que paso.
  transports.push(
    new winston.transports.DailyRotateFile({
      level: 'info',
      dirname: LOGS_DIR,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '7d',
      format: baseFormat,
    })
  );
}

const logger = winston.createLogger({
  levels: LEVELS,
  level: resolveConsoleLevel(),
  transports,
  // Un fallo del logger nunca debe tumbar el proceso.
  exitOnError: false,
});

/**
 * Registra que configuracion quedo activa. Se llama desde el arranque, cuando
 * ya tiene sentido escribir en disco.
 */
function logLoggerSetup() {
  logger.debug('Logger inicializado', {
    entorno: config.nodeEnv,
    nivelConsola: resolveConsoleLevel(),
    archivos: config.isTest ? 'deshabilitados en test' : LOGS_DIR,
  });
}

module.exports = { logger, LEVELS, LOGS_DIR, logLoggerSetup };
