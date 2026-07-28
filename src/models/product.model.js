/**
 * Esquema de Producto.
 *
 * El modelo SOLO describe la forma del documento y sus reglas de integridad
 * estructural (tipos, requeridos, enums, indices). No contiene logica de
 * negocio ni conoce a los controllers.
 */
const mongoose = require('mongoose');
const { PRODUCT_STATUS, PRODUCT_CATEGORIES } = require('../constants');

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'El titulo es obligatorio'],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: [true, 'La descripcion es obligatoria'],
      trim: true,
      maxlength: 1000,
    },
    code: {
      type: String,
      required: [true, 'El codigo es obligatorio'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    price: {
      type: Number,
      required: [true, 'El precio es obligatorio'],
      min: [0, 'El precio no puede ser negativo'],
    },
    stock: {
      type: Number,
      required: [true, 'El stock es obligatorio'],
      min: [0, 'El stock no puede ser negativo'],
      default: 0,
    },
    category: {
      type: String,
      required: [true, 'La categoria es obligatoria'],
      enum: Object.values(PRODUCT_CATEGORIES),
      default: PRODUCT_CATEGORIES.OTHER,
    },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.AVAILABLE,
    },
    thumbnails: {
      type: [String],
      default: [],
    },
    // Baja logica: los productos no se borran fisicamente del catalogo.
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indices pensados para los filtros mas frecuentes del listado.
productSchema.index({ category: 1, status: 1 });
productSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema);
