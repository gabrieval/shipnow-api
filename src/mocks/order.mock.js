/**
 * Generador de pedidos simulados.
 *
 * Recibe los usuarios y productos con los que tiene que armar la relacion: el
 * generador nunca sale a buscarlos por su cuenta (eso es trabajo del service).
 * Asi se garantiza que todo pedido apunte a un usuario y a productos que existen.
 */
const { faker } = require('@faker-js/faker');
const { ORDER_STATUS, ORDER_PRIORITY, MOCK_LIMITS } = require('../constants');

/**
 * @param {object} params
 * @param {object} params.user usuario dueno del pedido (debe tener `_id`)
 * @param {object[]} params.products catalogo del que se eligen los items
 * @param {number} [params.index] para el codigo de pedido unico dentro del lote
 */
function generateOrder({ user, products, index = 0 }) {
  const itemsCount = faker.number.int({ min: 1, max: Math.min(MOCK_LIMITS.MAX_ITEMS_PER_ORDER, products.length) });
  const chosen = faker.helpers.arrayElements(products, itemsCount);

  const items = chosen.map((product) => {
    const quantity = faker.number.int({ min: 1, max: 4 });
    const unitPrice = Number(product.price);

    return {
      product: product._id,
      title: product.title,
      quantity,
      unitPrice,
      subtotal: Number((unitPrice * quantity).toFixed(2)),
    };
  });

  return {
    code: `ORD-${String(index).padStart(4, '0')}-${faker.string.alphanumeric(5).toUpperCase()}`,
    user: user._id,
    items,
    // El total lo recalcula el MockService: es una regla de negocio, no del generador.
    total: 0,
    status: faker.helpers.arrayElement(Object.values(ORDER_STATUS)),
    priority: faker.helpers.arrayElement(Object.values(ORDER_PRIORITY)),
    shippingAddress: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zipCode: faker.location.zipCode(),
      country: faker.location.country(),
    },
    notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }) ?? '',
  };
}

/**
 * Genera `count` pedidos repartidos entre los usuarios recibidos.
 * @param {number} count
 * @param {{users: object[], products: object[]}} params
 */
function generateOrders(count, { users, products }) {
  return Array.from({ length: count }, (_, index) =>
    generateOrder({
      user: faker.helpers.arrayElement(users),
      products,
      index,
    })
  );
}

module.exports = { generateOrder, generateOrders };
