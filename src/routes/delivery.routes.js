/**
 * Rutas de entregas. Solo conectan path + verbo con un metodo del Controller.
 */
const { Router } = require('express');
const deliveryController = require('../controllers/delivery.controller');
const { uploadDeliveryReceipt } = require('../middlewares/upload.middleware');

const router = Router();

router.get('/', deliveryController.getAll);
router.get('/:did', deliveryController.getById);
router.patch('/:did/status', deliveryController.updateStatus);
router.patch('/:did/courier', deliveryController.assignCourier);
router.post('/:did/receipt', uploadDeliveryReceipt, deliveryController.uploadReceipt);

module.exports = router;
