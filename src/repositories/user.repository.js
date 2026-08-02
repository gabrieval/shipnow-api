/**
 * UserRepository - unico modulo que habla Mongoose para la entidad User.
 *
 * Encapsula dos decisiones de acceso propias de esta entidad:
 *  1. El hash de la contrasena nunca sale, salvo por el metodo explicito
 *     `getByEmailWithPassword` que se usa solo para autenticar.
 *  2. Toda consulta filtra usuarios dados de baja por defecto.
 */
const mongoose = require('mongoose');
const UserModel = require('../models/user.model');
const { SORT_ORDER } = require('../constants');

/** Proyeccion publica: sin password, sin isActive. */
const PUBLIC_PROJECTION = 'firstName lastName email role createdAt updatedAt';

const BASE_FILTER = Object.freeze({ isActive: true });

class UserRepository {
  constructor(model = UserModel) {
    this.model = model;
  }

  #withBaseFilter(filter = {}) {
    return { ...BASE_FILTER, ...filter };
  }

  #buildSort({ sortBy = 'createdAt', order = SORT_ORDER.DESC } = {}) {
    return { [sortBy]: order === SORT_ORDER.ASC ? 1 : -1 };
  }

  isValidId(id) {
    return mongoose.isValidObjectId(id);
  }

  /**
   * Genera un ObjectId nuevo sin tocar la base. Lo usa el modulo de mocking para
   * armar relaciones en los datos de vista previa, sin que el Service tenga que
   * importar Mongoose.
   */
  newId() {
    return new mongoose.Types.ObjectId();
  }

  /** Listado paginado de usuarios activos. */
  async getAll({ filter = {}, page = 1, limit = 10, sortBy, order } = {}) {
    const query = this.#withBaseFilter(filter);
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.model
        .find(query, PUBLIC_PROJECTION)
        .sort(this.#buildSort({ sortBy, order }))
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(query),
    ]);

    return {
      docs,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    };
  }

  async getById(id) {
    if (!this.isValidId(id)) return null;
    return this.model.findOne(this.#withBaseFilter({ _id: id }), PUBLIC_PROJECTION).lean();
  }

  /**
   * Busca por email sin traer el hash.
   * @param {string} email
   * @param {{includeInactive?: boolean}} [options] el email es unico tambien
   *   contra usuarios dados de baja, por eso el chequeo de duplicados los incluye.
   */
  async getByEmail(email, { includeInactive = false } = {}) {
    const normalized = String(email).toLowerCase().trim();
    const filter = includeInactive ? { email: normalized } : this.#withBaseFilter({ email: normalized });
    return this.model.findOne(filter, PUBLIC_PROJECTION).lean();
  }

  /**
   * Unica via para obtener el hash de la contrasena. Existe solo para el login;
   * cualquier otro flujo debe usar `getByEmail`.
   */
  async getByEmailWithPassword(email) {
    const normalized = String(email).toLowerCase().trim();
    return this.model
      .findOne(this.#withBaseFilter({ email: normalized }))
      .select(`${PUBLIC_PROJECTION} password`)
      .lean();
  }

  /** Cuenta usuarios activos que matcheen el filtro (ej.: cuantos admins quedan). */
  async countBy(filter = {}) {
    return this.model.countDocuments(this.#withBaseFilter(filter));
  }

  /** Inserta un usuario. La contrasena ya viene hasheada desde el Service. */
  async create(data) {
    const created = await this.model.create(data);
    return this.getById(created._id);
  }

  /**
   * Insercion masiva para la carga de datos de prueba. Las contrasenas ya vienen
   * hasheadas desde el Service. `ordered: false` evita que un email duplicado
   * aborte todo el lote.
   */
  async createMany(documents = []) {
    if (documents.length === 0) return [];
    // Sin `lean`: se necesita que Mongoose aplique defaults (isActive, status) y
    // valide los enums de cada documento antes de escribirlo.
    const inserted = await this.model.insertMany(documents, { ordered: false });
    return inserted.map((doc) => doc.toObject());
  }

  /** Borra fisicamente solo los usuarios marcados como simulados. */
  async deleteMocks() {
    const { deletedCount } = await this.model.deleteMany({ isMock: true });
    return deletedCount;
  }

  async update(id, changes) {
    if (!this.isValidId(id)) return null;
    return this.model
      .findOneAndUpdate(this.#withBaseFilter({ _id: id }), { $set: changes }, {
        new: true,
        runValidators: true,
        projection: PUBLIC_PROJECTION,
      })
      .lean();
  }

  /** Baja logica del usuario. */
  async softDelete(id) {
    if (!this.isValidId(id)) return null;
    return this.model
      .findOneAndUpdate(this.#withBaseFilter({ _id: id }), { $set: { isActive: false } }, {
        new: true,
        projection: PUBLIC_PROJECTION,
      })
      .lean();
  }
}

module.exports = new UserRepository();
module.exports.UserRepository = UserRepository;
