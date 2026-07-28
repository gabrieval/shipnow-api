/**
 * Construccion de la app Express. No abre el puerto ni conecta la base:
 * de eso se ocupa `server.js`. Separarlo deja la app lista para testear.
 */
const express = require('express');
const morgan = require('morgan');

const apiRoutes = require('./routes');
const attachRequester = require('./middlewares/requester.middleware');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { config } = require('./config');

function createApp() {
  const app = express();

  if (!config.isTest) app.use(morgan('dev'));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(attachRequester);

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
