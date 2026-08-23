/**
 * Rutas de pedidos. Solo conectan path + verbo con un metodo del Controller.
 */
const { Router } = require('express');
const orderController = require('../controllers/order.controller');
const { uploadOrderReceipt } = require('../middlewares/upload.middleware');

const router = Router();

router.get('/', orderController.getAll);
router.post('/', orderController.create);
router.get('/:oid', orderController.getById);
router.patch('/:oid/status', orderController.updateStatus);
router.post('/:oid/receipt', uploadOrderReceipt, orderController.uploadReceipt);

module.exports = router;
