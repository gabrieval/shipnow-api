/**
 * Cliente HTTP de los tests.
 *
 * Supertest recibe la app de Express directamente: como `app.js` esta separado
 * de `server.js`, no hace falta levantar ningun puerto a mano. Supertest abre
 * uno efimero por request y lo cierra solo.
 */
const supertest = require('supertest');
const createApp = require('../../src/app');
const { USER_ROLES } = require('../../src/constants');

const app = createApp();
const request = supertest(app);

/** Headers que simulan a un administrador. */
const asAdmin = { 'x-user-role': USER_ROLES.ADMIN };

/** Headers que simulan a un usuario comun. */
const asUser = { 'x-user-role': USER_ROLES.USER };

/** Headers que simulan a un usuario concreto (para operar sobre su propio perfil). */
const asSelf = (id) => ({ 'x-user-role': USER_ROLES.USER, 'x-user-id': String(id) });

module.exports = { app, request, asAdmin, asUser, asSelf };
