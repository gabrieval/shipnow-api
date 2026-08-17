/**
 * Carga inicial de datos para probar la API.
 * Usa los Services (no el modelo directo) para que los datos sembrados pasen
 * por las mismas reglas de negocio que un request real.
 *
 * Uso: npm run seed
 */
const { connectDB, disconnectDB, logger } = require('../config');
const productService = require('../services/product.service');
const userService = require('../services/user.service');
const { USER_ROLES, PRODUCT_CATEGORIES } = require('../constants');

const USERS = [
  {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'admin@shipnow.com',
    password: 'admin1234',
    role: USER_ROLES.ADMIN,
  },
  {
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@shipnow.com',
    password: 'usuario1234',
    role: USER_ROLES.USER,
  },
];

const PRODUCTS = [
  {
    title: 'Notebook 14 pulgadas',
    description: 'Notebook liviana con 16GB de RAM y SSD de 512GB',
    code: 'SN-NB-001',
    price: 899.99,
    stock: 12,
    category: PRODUCT_CATEGORIES.ELECTRONICS,
  },
  {
    title: 'Auriculares inalambricos',
    description: 'Bluetooth 5.3 con cancelacion activa de ruido',
    code: 'SN-AU-002',
    price: 149.5,
    stock: 40,
    category: PRODUCT_CATEGORIES.ELECTRONICS,
  },
  {
    title: 'Campera rompeviento',
    description: 'Campera impermeable unisex, talles S a XL',
    code: 'SN-CA-003',
    price: 79.9,
    stock: 0, // queda OUT_OF_STOCK por la regla del service
    category: PRODUCT_CATEGORIES.CLOTHING,
  },
  {
    title: 'Set de mates',
    description: 'Mate de acero con bombilla y yerbera',
    code: 'SN-MA-004',
    price: 34.75,
    stock: 25,
    category: PRODUCT_CATEGORIES.HOME,
  },
];

async function seed() {
  await connectDB();

  for (const user of USERS) {
    try {
      await userService.create(user, USER_ROLES.ADMIN);
      logger.info('Seed: usuario creado', { email: user.email, rol: user.role });
    } catch (error) {
      logger.warning('Seed: usuario omitido', { email: user.email, motivo: error.message });
    }
  }

  for (const product of PRODUCTS) {
    try {
      const created = await productService.create(product, USER_ROLES.ADMIN);
      logger.info('Seed: producto creado', { code: created.code, status: created.status });
    } catch (error) {
      logger.warning('Seed: producto omitido', { code: product.code, motivo: error.message });
    }
  }

  await disconnectDB();
}

seed().catch(async (error) => {
  logger.fatal('Seed: fallo la carga inicial', { motivo: error.message });
  await disconnectDB().catch(() => {});
  process.exit(1);
});
