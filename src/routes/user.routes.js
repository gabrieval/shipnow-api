/**
 * Rutas de usuarios. Solo conectan path + verbo con un metodo del Controller.
 */
const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { uploadUserDocument } = require('../middlewares/upload.middleware');

const router = Router();

router.get('/', userController.getAll);
router.get('/:uid', userController.getById);
router.post('/', userController.create);
router.post('/login', userController.login);
router.put('/:uid', userController.update);
router.patch('/:uid/role', userController.changeRole);
router.post('/:uid/documents', uploadUserDocument, userController.uploadDocument);
router.delete('/:uid', userController.delete);

module.exports = router;
