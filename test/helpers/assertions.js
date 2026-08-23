/**
 * Aserciones compartidas sobre el CONTRATO de la API.
 *
 * La consigna pide no quedarse en "responde" o "falla": estas funciones validan
 * la forma completa de la respuesta, que es la que definieron los modulos 3 y 5.
 */
const { expect } = require('chai');
const {
  USER_ROLES,
  PRODUCT_STATUS,
  ORDER_STATUS,
  ORDER_PRIORITY,
  DELIVERY_STATUS,
  DELIVERY_STATUS_REQUIRING_COURIER,
} = require('../../src/constants');

/**
 * Valida una respuesta exitosa: status esperado, envoltura `success` y
 * ausencia del bloque `error`.
 * @returns el payload, para seguir encadenando aserciones
 */
function expectSuccess(res, statusEsperado = 200) {
  expect(res.status, `status inesperado. body: ${JSON.stringify(res.body)}`).to.equal(statusEsperado);
  expect(res.body).to.be.an('object');
  expect(res.body).to.have.property('status', 'success');
  expect(res.body).to.have.property('payload');
  expect(res.body).to.not.have.property('error');
  return res.body.payload;
}

/**
 * Valida una respuesta de error con la estructura del modulo 3:
 * `{ status, error: { code, message, details? }, timestamp, path }`.
 * @returns el bloque `error`
 */
function expectError(res, statusEsperado, codeEsperado) {
  expect(res.status, `status inesperado. body: ${JSON.stringify(res.body)}`).to.equal(statusEsperado);
  expect(res.body).to.have.property('status', 'error');
  expect(res.body).to.not.have.property('payload');

  expect(res.body).to.have.property('error').that.is.an('object');
  expect(res.body.error).to.have.property('code', codeEsperado);
  expect(res.body.error).to.have.property('message').that.is.a('string');
  expect(res.body.error.message).to.have.length.greaterThan(0);

  expect(res.body).to.have.property('timestamp').that.is.a('string');
  expect(new Date(res.body.timestamp).toString()).to.not.equal('Invalid Date');
  expect(res.body).to.have.property('path').that.is.a('string');

  return res.body.error;
}

/** Valida el bloque de paginacion que devuelven todos los listados. */
function expectPagination(pagination) {
  expect(pagination).to.be.an('object');
  expect(pagination).to.include.all.keys('total', 'page', 'limit', 'totalPages', 'hasPrevPage', 'hasNextPage');
  expect(pagination.total).to.be.a('number');
  expect(pagination.page).to.be.a('number');
  expect(pagination.limit).to.be.a('number');
  expect(pagination.hasPrevPage).to.be.a('boolean');
  expect(pagination.hasNextPage).to.be.a('boolean');
}

/** Valida la forma de un usuario, incluido que NUNCA viaje la contrasena. */
function expectUserShape(user) {
  expect(user).to.be.an('object');
  expect(user).to.include.all.keys('_id', 'firstName', 'lastName', 'email', 'role');
  expect(user).to.not.have.property('password');
  expect(Object.values(USER_ROLES)).to.include(user.role);
}

/** Valida la forma de un producto. */
function expectProductShape(product) {
  expect(product).to.be.an('object');
  expect(product).to.include.all.keys('_id', 'title', 'description', 'code', 'price', 'stock', 'category', 'status');
  expect(product.price).to.be.a('number');
  expect(product.stock).to.be.a('number');
  expect(Object.values(PRODUCT_STATUS)).to.include(product.status);
}

/** Valida la forma de un pedido y la coherencia de sus totales. */
function expectOrderShape(order) {
  expect(order).to.be.an('object');
  expect(order).to.include.all.keys('_id', 'code', 'user', 'items', 'total', 'status', 'priority', 'shippingAddress');
  expect(order.items).to.be.an('array');
  expect(order.items).to.have.length.greaterThan(0);
  expect(Object.values(ORDER_STATUS)).to.include(order.status);
  expect(Object.values(ORDER_PRIORITY)).to.include(order.priority);

  for (const item of order.items) {
    expect(item).to.include.all.keys('product', 'title', 'quantity', 'unitPrice', 'subtotal');
    expect(item.subtotal).to.be.closeTo(item.unitPrice * item.quantity, 0.01);
  }

  const suma = order.items.reduce((acc, item) => acc + item.subtotal, 0);
  expect(order.total, 'el total debe ser la suma de los subtotales').to.be.closeTo(suma, 0.01);
}

/** Valida la forma de una entrega y su coherencia con el repartidor. */
function expectDeliveryShape(delivery) {
  expect(delivery).to.be.an('object');
  expect(delivery).to.include.all.keys('_id', 'trackingCode', 'order', 'status', 'estimatedDate');
  expect(Object.values(DELIVERY_STATUS)).to.include(delivery.status);

  if (DELIVERY_STATUS_REQUIRING_COURIER.includes(delivery.status)) {
    expect(delivery.courier, `la entrega en estado ${delivery.status} deberia tener repartidor`).to.not.equal(null);
  }
}

module.exports = {
  expectSuccess,
  expectError,
  expectPagination,
  expectUserShape,
  expectProductShape,
  expectOrderShape,
  expectDeliveryShape,
};
