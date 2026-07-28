/**
 * Esquema de Entrega.
 *
 * Relaciones: una entrega pertenece a UN pedido (1 a 1, por eso el indice unico)
 * y puede tener un repartidor asignado. El repartidor es un User con rol COURIER;
 * la coherencia "si el estado exige repartidor, tiene que haber uno" la garantiza
 * el service, no el esquema.
 */
const mongoose = require('mongoose');
const { DELIVERY_STATUS } = require('../constants');

const deliverySchema = new mongoose.Schema(
  {
    trackingCode: {
      type: String,
      required: [true, 'El codigo de seguimiento es obligatorio'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    // Relacion entrega -> pedido (1 a 1).
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'La entrega debe estar asociada a un pedido'],
      unique: true,
    },
    // Relacion entrega -> repartidor (User con rol COURIER). Null si aun no se asigno.
    courier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(DELIVERY_STATUS),
      default: DELIVERY_STATUS.PENDING_ASSIGNMENT,
    },
    estimatedDate: {
      type: Date,
      required: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
      min: [0, 'Los intentos no pueden ser negativos'],
    },
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

module.exports = mongoose.model('Delivery', deliverySchema);
