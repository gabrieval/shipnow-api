/**
 * Punto de entrada. Orden de arranque:
 *   1. Se valida la configuracion de entorno (al requerir ./config).
 *   2. Se conecta a MongoDB.
 *   3. Recien ahi se abre el puerto HTTP.
 * Si algo falla, se registra como `fatal` y se corta el proceso.
 */
const createApp = require('./app');
const { config, connectDB, disconnectDB, logger, logLoggerSetup } = require('./config');

async function bootstrap() {
  logLoggerSetup();

  await connectDB();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`Servidor ShipNow escuchando en el puerto ${config.port}`, {
      url: `http://localhost:${config.port}/api`,
      entorno: config.nodeEnv,
    });
  });

  const shutdown = async (signal) => {
    logger.info(`Senal ${signal} recibida, cerrando el servidor`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Ultima red: cualquier fallo que se escape del ciclo de request queda registrado
  // como `fatal` antes de que el proceso muera.
  process.on('uncaughtException', (error) => {
    logger.fatal('Excepcion no capturada, cerrando el proceso', { motivo: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal('Promesa rechazada sin manejar', { motivo: reason instanceof Error ? reason.message : String(reason) });
  });
}

bootstrap().catch((error) => {
  logger.fatal('Fallo el arranque de ShipNow', { motivo: error.message });
  process.exit(1);
});
