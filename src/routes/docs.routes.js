/**
 * Ruta de la documentacion interactiva.
 *
 * Solo monta Swagger UI: la definicion de la API vive en `config/swagger.config.js`
 * (informacion general y opciones) y en los YAML de `src/docs/` (endpoints y schemas).
 * Aca no hay ni una linea de documentacion.
 */
const { Router } = require('express');
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec, swaggerUiOptions } = require('../config/swagger.config');

const router = Router();

// Especificacion cruda, por si se quiere importar en Postman o Insomnia.
router.get('/docs.json', (req, res) => res.json(swaggerSpec));

router.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

module.exports = router;
