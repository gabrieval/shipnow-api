/**
 * Rutas del modulo de mocking. Solo conectan path + verbo con un metodo del
 * Controller: ni un `faker`, ni un `if`, ni una consulta viven aca.
 */
const { Router } = require('express');
const mockController = require('../controllers/mock.controller');

const router = Router();

// Vista previa: devuelven datos simulados sin guardarlos.
router.get('/users', mockController.getUsers);
router.get('/couriers', mockController.getCouriers);
router.get('/products', mockController.getProducts);
router.get('/orders', mockController.getOrders);
router.get('/deliveries', mockController.getDeliveries);
router.get('/dataset', mockController.getDataset);

// Estado y carga controlada en MongoDB.
router.get('/summary', mockController.getSummary);
router.post('/generateData', mockController.generateData);
router.delete('/', mockController.clear);

module.exports = router;
