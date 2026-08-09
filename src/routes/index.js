/**
 * Router raiz: monta cada modulo de rutas bajo su prefijo.
 */
const { Router } = require('express');
const productRoutes = require('./product.routes');
const userRoutes = require('./user.routes');
const orderRoutes = require('./order.routes');
const deliveryRoutes = require('./delivery.routes');
const mockRoutes = require('./mock.routes');
const docsRoutes = require('./docs.routes');
const healthController = require('../controllers/health.controller');
const loggerController = require('../controllers/logger.controller');

const router = Router();

// La documentacion se monta primero: es la puerta de entrada al resto de la API.
router.use('/', docsRoutes);

router.get('/health', healthController.check);
router.get('/logger-test', loggerController.test);

router.use('/products', productRoutes);
router.use('/users', userRoutes);
router.use('/orders', orderRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/mocks', mockRoutes);

module.exports = router;
