/**
 * Punto de entrada. Orden de arranque:
 *   1. Se valida la configuracion de entorno (al requerir ./config).
 *   2. Se conecta a MongoDB.
 *   3. Recien ahi se abre el puerto HTTP.
 * Si algo falla, se corta el proceso con un mensaje claro.
 */
const createApp = require('./app');
const { config, connectDB, disconnectDB } = require('./config');

async function bootstrap() {
  await connectDB();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] ShipNow API escuchando en http://localhost:${config.port}/api (${config.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} recibido, cerrando...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
