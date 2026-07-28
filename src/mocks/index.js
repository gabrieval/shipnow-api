/**
 * Barrel de la capa de generadores.
 *
 * Todo lo que esta debajo de `src/mocks/` son funciones puras: reciben datos,
 * devuelven objetos planos y no conocen Mongoose, Express ni la base. El unico
 * consumidor es `MockService`.
 */
const { generateUser, generateUsers, generateCourier, generateCouriers } = require('./user.mock');
const { generateProduct, generateProducts } = require('./product.mock');
const { generateOrder, generateOrders } = require('./order.mock');
const { generateDelivery, generateDeliveries } = require('./delivery.mock');

module.exports = {
  generateUser,
  generateUsers,
  generateCourier,
  generateCouriers,
  generateProduct,
  generateProducts,
  generateOrder,
  generateOrders,
  generateDelivery,
  generateDeliveries,
};
