/**
 * Conexion a MongoDB. Unico lugar donde se abre/cierra el cliente de Mongoose.
 * Toma la URI del objeto de configuracion validado, nunca de process.env.
 */
const mongoose = require('mongoose');
const { mongodbUri, isProduction } = require('./env.config');

mongoose.set('strictQuery', true);

async function connectDB() {
  try {
    await mongoose.connect(mongodbUri, { serverSelectionTimeoutMS: 10000 });
    console.log(`[db] Conectado a MongoDB -> base "${mongoose.connection.name}"`);
    return mongoose.connection;
  } catch (error) {
    // Mensaje explicito: la causa mas comun es una URI mal escrita o Mongo apagado.
    throw new Error(`[db] No se pudo conectar a MongoDB. Detalle: ${error.message}`);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (!isProduction) console.log('[db] Conexion cerrada');
}

module.exports = { connectDB, disconnectDB };
