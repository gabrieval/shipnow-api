/**
 * Root hooks de Mocha: corren una vez para toda la suite.
 *
 * Se declara con `--require` en `.mocharc.json`, asi ningun archivo de test
 * tiene que acordarse de conectar o limpiar.
 */
const fs = require('fs');
const { connect, disconnect, clean } = require('./database');
const { config } = require('../../src/config');
const { UPLOAD_ROOT } = require('../../src/config/multer.config');

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

    // Los tests escriben en `uploads-test/`, una carpeta aparte de la real:
    // se borra entera para no dejar basura despues de cada corrida.
    if (config.isTest && UPLOAD_ROOT.endsWith('uploads-test')) {
      await fs.promises.rm(UPLOAD_ROOT, { recursive: true, force: true });
    }
  },
};
