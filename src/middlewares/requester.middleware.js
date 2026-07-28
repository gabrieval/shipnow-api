/**
 * Identifica quien ejecuta la request y lo deja en `req.requester`.
 *
 * En este modulo todavia no hay autenticacion (llega en el modulo de JWT/sesiones),
 * asi que el identificador y el rol se toman de los headers `x-user-id` y
 * `x-user-role`. La ventaja de aislarlo en un middleware es que cuando entre
 * Passport/JWT solo cambia este archivo: los Services ya reciben `{ id, role }`
 * y no se enteran de donde salio.
 */
const { USER_ROLES } = require('../constants');

function attachRequester(req, res, next) {
  const headerRole = String(req.get('x-user-role') || '').toLowerCase();
  const role = Object.values(USER_ROLES).includes(headerRole) ? headerRole : USER_ROLES.USER;

  req.requester = {
    id: req.get('x-user-id') || null,
    role,
  };

  next();
}

module.exports = attachRequester;
