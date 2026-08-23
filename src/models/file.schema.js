/**
 * Sub-esquema de metadatos de archivo.
 *
 * En MongoDB se guarda SOLO informacion sobre el archivo, nunca su contenido:
 * el binario vive en el sistema de archivos y aca queda la referencia.
 *
 * Lo comparten usuarios (documentos), pedidos y entregas (comprobantes).
 */
const mongoose = require('mongoose');
const { DOCUMENT_TYPES } = require('../constants');

const fileSchema = new mongoose.Schema(
  {
    /** Nombre con el que el cliente subio el archivo. */
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    /** Nombre generado por el servidor, unico dentro de su carpeta. */
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    /** Ruta relativa a la carpeta de uploads. Nunca una ruta absoluta del servidor. */
    path: {
      type: String,
      required: true,
      trim: true,
    },
    /** Tipo MIME reportado en la carga. */
    mimeType: {
      type: String,
      required: true,
    },
    /** Tamano en bytes. */
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Solo aplica a documentos de usuario; los comprobantes no lo llevan. */
    documentType: {
      type: String,
      enum: Object.values(DOCUMENT_TYPES),
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

module.exports = fileSchema;
