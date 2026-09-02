/**
 * Esquema de Usuario.
 *
 * Igual que Product: solo estructura. El hasheo de la contrasena vive en el
 * Service (regla de negocio) y no en un hook del modelo, para que la capa de
 * persistencia no tome decisiones de dominio.
 */
const mongoose = require('mongoose');
const { USER_ROLES } = require('../constants');
const fileSchema = require('./file.schema');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      maxlength: 60,
    },
    lastName: {
      type: String,
      required: [true, 'El apellido es obligatorio'],
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'La contrasena es obligatoria'],
      // select: false -> ninguna consulta trae el hash salvo que se pida explicito.
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
    },
    /**
     * Documentos adjuntos del usuario (DNI, licencia, seguro...).
     * Solo METADATOS: el archivo vive en la carpeta `uploads/`.
     */
    documents: {
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

module.exports = mongoose.model('User', userSchema);
