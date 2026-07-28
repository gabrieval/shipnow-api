/**
 * Rutas de productos. Solo conectan path + verbo con un metodo del Controller.
 */
const { Router } = require('express');
const productController = require('../controllers/product.controller');

const router = Router();

router.get('/', productController.getAll);
router.get('/available', productController.getAvailable);
router.get('/:pid', productController.getById);
router.post('/', productController.create);
router.put('/:pid', productController.update);
router.patch('/:pid/stock', productController.decreaseStock);
router.delete('/:pid', productController.delete);

module.exports = router;
