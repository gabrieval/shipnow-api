/**
 * Base de datos del entorno de testing.
 *
 * Por defecto levanta una instancia de MongoDB EN MEMORIA: los tests corren sin
 * necesidad de tener MongoDB instalado y nunca tocan la base de desarrollo.
 *
 * Si se define `USE_REAL_DB=true` (script `npm run test:db`), se conecta a la
 * `MONGODB_URI` de `.env.test`, que debe apuntar a una base exclusiva de tests.
 */
const mongoose = require('mongoose');
const { config } = require('../../src/config');

let memoryServer = null;

async function connect() {
  if (mongoose.connection.readyState === 1) return;

  let uri = config.mongodbUri;

  if (process.env.USE_REAL_DB !== 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri('shipnow_test');
  }

  await mongoose.connect(uri);
}

async function disconnect() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

/**
 * Vacia todas las colecciones. Se ejecuta despues de cada test para que ninguno
 * dependa del estado que dejo otro ni del orden de ejecucion.
 */
async function clean() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

module.exports = { connect, disconnect, clean };
