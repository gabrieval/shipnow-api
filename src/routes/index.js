/**
 * Router raiz: monta cada modulo de rutas bajo su prefijo.
 */
const { Router } = require('express');
const productRoutes = require('./product.routes');
const userRoutes = require('./user.routes');

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

router.use('/products', productRoutes);
router.use('/users', userRoutes);

module.exports = router;
