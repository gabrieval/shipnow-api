/**
 * Generador de productos simulados, con la forma del modelo Product.
 * El `status` se deriva del stock con la misma regla que usa ProductService,
 * para que un producto simulado nunca quede en un estado imposible.
 */
const { faker } = require('@faker-js/faker');
const { PRODUCT_CATEGORIES, PRODUCT_STATUS } = require('../constants');

function generateProduct({ index = 0 } = {}) {
  const stock = faker.number.int({ min: 0, max: 120 });

  return {
    title: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    // Prefijo + indice + sufijo aleatorio: codigo unico dentro del lote.
    code: `MOCK-${String(index).padStart(4, '0')}-${faker.string.alphanumeric(4).toUpperCase()}`,
    price: Number(faker.commerce.price({ min: 5, max: 2000, dec: 2 })),
    stock,
    category: faker.helpers.arrayElement(Object.values(PRODUCT_CATEGORIES)),
    // Misma regla de dominio que ProductService: sin stock -> OUT_OF_STOCK.
    status: stock > 0 ? PRODUCT_STATUS.AVAILABLE : PRODUCT_STATUS.OUT_OF_STOCK,
    thumbnails: [faker.image.url()],
  };
}

function generateProducts(count) {
  return Array.from({ length: count }, (_, index) => generateProduct({ index }));
}

module.exports = { generateProduct, generateProducts };
