/**
 * Esquema de Pedido.
 *
 * Relacion: un pedido pertenece a un usuario y referencia productos del catalogo.
 * Igual que el resto de los modelos: solo estructura, sin logica de negocio.
 * El total NO se calcula aca (lo hace el service), el modelo solo lo persiste.
 */
const mongoose = require('mongoose');
const fileSchema = require('./file.schema');
const { ORDER_STATUS, ORDER_PRIORITY } = require('../constants');

/** Linea de pedido: se guarda el precio al momento de la compra, no el actual. */
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'La cantidad debe ser al menos 1'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'El precio unitario no puede ser negativo'],
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'El subtotal no puede ser negativo'],
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'El codigo de pedido es obligatorio'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    // Relacion pedido -> usuario que lo hizo.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El pedido debe pertenecer a un usuario'],
      index: true,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'El pedido debe tener al menos un item',
      },
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'El total no puede ser negativo'],
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
    },
    priority: {
      type: String,
      enum: Object.values(ORDER_PRIORITY),
      default: ORDER_PRIORITY.NORMAL,
    },
    shippingAddress: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, required: true, trim: true },
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    /** Comprobantes de pago asociados al pedido. Solo metadatos. */
    receipts: {
      type: [fileSchema],
      default: [],
    },
    // Marca de dato generado por el modulo de mocking (ver mock.service.js).
    isMock: {
      type: Boolean,
      default: false,
      index: true,
    },
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

orderSchema.index({ status: 1, priority: 1 });

module.exports = mongoose.model('Order', orderSchema);
