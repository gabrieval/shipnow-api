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
const internalOnly = require('../middlewares/internal.middleware');
const { config } = require('../config');

const router = Router();

// La documentacion se monta primero: es la puerta de entrada al resto de la API.
// Se puede apagar con ENABLE_DOCS=false si el despliegue es privado.
if (config.enableDocs) router.use('/', docsRoutes);

router.get('/health', healthController.check);
router.get('/logger-test', internalOnly, loggerController.test);

router.use('/products', productRoutes);
router.use('/users', userRoutes);
router.use('/orders', orderRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/mocks', internalOnly, mockRoutes);

module.exports = router;
