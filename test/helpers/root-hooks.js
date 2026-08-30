/**
 * Root hooks de Mocha: corren una vez para toda la suite.
 *
 * Se declara con `--require` en `.mocharc.json`, asi ningun archivo de test
 * tiene que acordarse de conectar o limpiar.
 */
const { connect, disconnect, clean } = require('./database');
const { config } = require('../../src/config');

exports.mochaHooks = {
  async beforeAll() {
    if (!config.isTest) {
      throw new Error(
        `Los tests solo pueden correr con NODE_ENV=test (actual: "${config.nodeEnv}"). Usa "npm test".`
      );
    }
    await connect();
  },

  // Limpieza despues de CADA test: datos controlados y repetibles.
  async afterEach() {
    await clean();
  },

  async afterAll() {
    await disconnect();
  },
};
