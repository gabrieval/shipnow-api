/**
 * Generador de usuarios simulados.
 *
 * Capa de generacion: funciones puras que devuelven objetos planos con la misma
 * forma que el modelo real. No tocan la base, no hashean contrasenas y no
 * deciden reglas de negocio; de eso se ocupa el MockService.
 */
const { faker } = require('@faker-js/faker');
const { USER_ROLES, MOCK_LIMITS } = require('../constants');

/** Roles que puede recibir un usuario "comun" generado al azar. */
const RANDOM_ROLES = [USER_ROLES.USER, USER_ROLES.ADMIN];

/**
 * Genera un usuario con la estructura del modelo User.
 * @param {{role?: string, index?: number}} [options] `role` fuerza el rol;
 *   `index` se usa para que el email sea unico dentro del lote generado.
 */
function generateUser({ role, index = 0 } = {}) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const finalRole = role ?? faker.helpers.arrayElement(RANDOM_ROLES);

  return {
    firstName,
    lastName,
    // El sufijo evita colisiones de email dentro de un mismo lote.
    email: `${faker.internet
      .username({ firstName, lastName })
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')}.${index}${faker.string.alphanumeric(4).toLowerCase()}@shipnow.dev`,
    // Contrasena en claro: el MockService la hashea antes de persistir.
    password: MOCK_LIMITS.DEFAULT_PASSWORD,
    role: finalRole,
  };
}

/**
 * Genera un repartidor: es un usuario con rol COURIER.
 * Existe como funcion aparte para que el rol nunca quede librado al azar.
 */
function generateCourier({ index = 0 } = {}) {
  return generateUser({ role: USER_ROLES.COURIER, index });
}

/** Genera `count` usuarios. */
function generateUsers(count, { role } = {}) {
  return Array.from({ length: count }, (_, index) => generateUser({ role, index }));
}

/** Genera `count` repartidores. */
function generateCouriers(count) {
  return Array.from({ length: count }, (_, index) => generateCourier({ index }));
}

module.exports = { generateUser, generateUsers, generateCourier, generateCouriers };
