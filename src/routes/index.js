/**
 * Router raiz: monta cada modulo de rutas bajo su prefijo.
 */
const { Router } = require('express');
const productRoutes = require('./product.routes');
const userRoutes = require('./user.routes');
const mockRoutes = require('./mock.routes');
const healthController = require('../controllers/health.controller');
const loggerController = require('../controllers/logger.controller');

const router = Router();

router.get('/health', healthController.check);
router.get('/logger-test', loggerController.test);

router.use('/products', productRoutes);
router.use('/users', userRoutes);
router.use('/mocks', mockRoutes);

module.exports = router;
