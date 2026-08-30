/**
 * Datos de prueba controlados y repetibles.
 *
 * Ningun test depende de datos cargados a mano ni de lo que haya dejado otro:
 * cada uno crea lo que necesita a traves de la propia API (o del modulo de
 * mocks), y los root hooks vacian las colecciones al terminar.
 *
 * Los emails y codigos llevan un sufijo incremental para que dos llamadas
 * seguidas dentro del mismo test no choquen contra los indices unicos.
 */
const { request, asAdmin } = require('./request');
const { USER_ROLES, PRODUCT_CATEGORIES } = require('../../src/constants');

let contador = 0;
const unico = () => `${Date.now().toString(36)}${(contador += 1)}`;

/** Contrasena valida compartida por los usuarios de prueba. */
const PASSWORD = 'testing1234';

function buildUser(overrides = {}) {
  const sufijo = unico();
  return {
    firstName: 'Test',
    lastName: 'User',
    email: `test.${sufijo}@shipnow.test`,
    password: PASSWORD,
    ...overrides,
  };
}

function buildProduct(overrides = {}) {
  const sufijo = unico();
  return {
    title: `Producto de prueba ${sufijo}`,
    description: 'Producto creado por la suite de tests',
    code: `TEST-${sufijo.toUpperCase()}`,
    price: 100,
    stock: 10,
    category: PRODUCT_CATEGORIES.ELECTRONICS,
    ...overrides,
  };
}

function buildAddress(overrides = {}) {
  return {
    street: 'Av. Siempre Viva 742',
    city: 'Rosario',
    state: 'Santa Fe',
    zipCode: 'S2000',
    country: 'Argentina',
    ...overrides,
  };
}

/** Crea un usuario real vía API y devuelve el payload. */
async function createUser(overrides = {}) {
  const body = buildUser(overrides);
  const headers = body.role ? asAdmin : {};
  const res = await request.post('/api/users').set(headers).send(body);
  if (res.status !== 201) throw new Error(`No se pudo crear el usuario de prueba: ${JSON.stringify(res.body)}`);
  return { ...res.body.payload, password: body.password };
}

/** Crea un repartidor (usuario con rol courier). */
function createCourier(overrides = {}) {
  return createUser({ role: USER_ROLES.COURIER, ...overrides });
}

/** Crea un producto real vía API. */
async function createProduct(overrides = {}) {
  const res = await request.post('/api/products').set(asAdmin).send(buildProduct(overrides));
  if (res.status !== 201) throw new Error(`No se pudo crear el producto de prueba: ${JSON.stringify(res.body)}`);
  return res.body.payload;
}

/**
 * Crea un pedido completo: usuario + producto + pedido.
 * Devuelve las tres entidades, porque los tests suelen necesitar las tres.
 */
async function createOrder({ user, product, quantity = 2, ...overrides } = {}) {
  const owner = user ?? (await createUser());
  const item = product ?? (await createProduct());

  const res = await request.post('/api/orders').send({
    user: owner._id,
    items: [{ product: item._id, quantity }],
    shippingAddress: buildAddress(),
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`No se pudo crear el pedido de prueba: ${JSON.stringify(res.body)}`);

  return { order: res.body.payload, user: owner, product: item };
}

/** Genera un lote de datos simulados con el modulo de mocks. */
async function generateMockData(body = { users: 2, couriers: 1, products: 3, orders: 2, deliveries: 2 }) {
  const res = await request.post('/api/mocks/generateData').set(asAdmin).send(body);
  if (res.status !== 201) throw new Error(`No se pudo generar el lote de mocks: ${JSON.stringify(res.body)}`);
  return res.body.payload;
}

/** Id con formato valido de ObjectId que con certeza no existe en la base. */
const ID_INEXISTENTE = '64b7f1f1f1f1f1f1f1f1f1f1';

module.exports = {
  PASSWORD,
  ID_INEXISTENTE,
  buildUser,
  buildProduct,
  buildAddress,
  createUser,
  createCourier,
  createProduct,
  createOrder,
  generateMockData,
};
