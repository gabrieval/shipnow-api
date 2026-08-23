/**
 * Middlewares de carga listos para usar en los routers.
 *
 * Cada uno sabe en que subcarpeta va su archivo y que campo del formulario
 * espera. Toda la configuracion de Multer vive en `config/multer.config.js`:
 * aca solo se arman las variantes concretas del proyecto.
 */
const { buildUploader } = require('../config/multer.config');
const { UPLOAD_RULES, DOCUMENT_TYPES } = require('../constants');

/**
 * Documentos de usuario. La subcarpeta depende del tipo de documento, asi que
 * quedan separados: `documents/id_card`, `documents/driver_license`, etc.
 * Si el tipo no es valido, el archivo cae en `documents/other` y el Service
 * despues rechaza la peticion y lo borra.
 */
const uploadUserDocument = buildUploader({
  field: UPLOAD_RULES.FIELDS.USER_DOCUMENT,
  folder: (req) => {
    const tipo = req.body?.documentType;
    const esValido = Object.values(DOCUMENT_TYPES).includes(tipo);
    return `${UPLOAD_RULES.FOLDERS.DOCUMENTS}/${esValido ? tipo : DOCUMENT_TYPES.OTHER}`;
  },
});

/** Comprobante de pago de un pedido. */
const uploadOrderReceipt = buildUploader({
  field: UPLOAD_RULES.FIELDS.RECEIPT,
  folder: UPLOAD_RULES.FOLDERS.ORDER_RECEIPTS,
});

/** Comprobante de entrega (constancia de que el pedido llego). */
const uploadDeliveryReceipt = buildUploader({
  field: UPLOAD_RULES.FIELDS.RECEIPT,
  folder: UPLOAD_RULES.FOLDERS.DELIVERY_RECEIPTS,
});

module.exports = { uploadUserDocument, uploadOrderReceipt, uploadDeliveryReceipt };
