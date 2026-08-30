/**
 * Conexion a MongoDB. Unico lugar donde se abre/cierra el cliente de Mongoose.
 * Toma la URI del objeto de configuracion validado, nunca de process.env.
 */
const mongoose = require('mongoose');
const { mongodbUri } = require('./env.config');
const { logger } = require('./logger.config');

mongoose.set('strictQuery', true);

async function connectDB() {
  try {
    await mongoose.connect(mongodbUri, { serverSelectionTimeoutMS: 10000 });
    logger.info('Conexion a MongoDB establecida', { base: mongoose.connection.name });
    return mongoose.connection;
  } catch (error) {
    // No poder conectar a la base al arrancar es una falla critica: sin base no
    // hay API que valga. Se loguea como `fatal` antes de propagar.
    logger.fatal('No se pudo conectar a MongoDB', { motivo: error.message });
    throw new Error(`[db] No se pudo conectar a MongoDB. Detalle: ${error.message}`);
  }
}

// Perdida de conexion despues del arranque: la app sigue viva pero degradada.
mongoose.connection.on('disconnected', () => logger.warning('Se perdio la conexion con MongoDB'));
mongoose.connection.on('reconnected', () => logger.info('Se restablecio la conexion con MongoDB'));
mongoose.connection.on('error', (error) => logger.error('Error de la conexion con MongoDB', { motivo: error.message }));

/**
 * Estado legible de la conexion con MongoDB.
 *
 * Vive aca porque `db.config.js` ya es una de las capas que conoce Mongoose: el
 * health check lo necesita, pero un controller no deberia importar el driver
 * solo para leer un numero.
 */
const ESTADOS_DE_CONEXION = Object.freeze({
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
});

function getConnectionState() {
  return ESTADOS_DE_CONEXION[mongoose.connection.readyState] ?? 'unknown';
}

async function disconnectDB() {
  await mongoose.disconnect();
  logger.info('Conexion con MongoDB cerrada');
}

module.exports = { connectDB, disconnectDB, getConnectionState };
