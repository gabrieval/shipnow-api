/**
 * OrderRepository - unico modulo que habla Mongoose para la entidad Order.
 *
 * Encapsula el filtro base de baja logica, la proyeccion publica, el populate
 * de las relaciones (usuario y productos) y la insercion masiva que usa el
 * modulo de mocking.
 */
const mongoose = require('mongoose');
const OrderModel = require('../models/order.model');
const { SORT_ORDER } = require('../constants');

const PUBLIC_PROJECTION = 'code user items total status priority shippingAddress notes receipts isMock createdAt updatedAt';

const BASE_FILTER = Object.freeze({ isActive: true });

/** Relaciones que se resuelven al leer un pedido. */
const POPULATE_USER = { path: 'user', select: 'firstName lastName email role' };

class OrderRepository {
  constructor(model = OrderModel) {
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

  /** Listado paginado con el usuario ya resuelto. */
  async getAll({ filter = {}, page = 1, limit = 10, sortBy, order } = {}) {
    const query = this.#withBaseFilter(filter);
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.model
        .find(query, PUBLIC_PROJECTION)
        .populate(POPULATE_USER)
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
    return this.model
      .findOne(this.#withBaseFilter({ _id: id }), PUBLIC_PROJECTION)
      .populate(POPULATE_USER)
      .lean();
  }

  async countBy(filter = {}) {
    return this.model.countDocuments(this.#withBaseFilter(filter));
  }

  async create(data) {
    const created = await this.model.create(data);
    return this.getById(created._id);
  }

  /** Adjunta los metadatos de un comprobante, sin leer y reescribir el array. */
  async addReceipt(id, metadata) {
    if (!this.isValidId(id)) return null;
    await this.model.updateOne(this.#withBaseFilter({ _id: id }), { $push: { receipts: metadata } });
    return this.getById(id);
  }

  /** Actualiza campos puntuales y devuelve el documento resultante. */
  async update(id, changes) {
    if (!this.isValidId(id)) return null;
    await this.model.findOneAndUpdate(this.#withBaseFilter({ _id: id }), { $set: changes }, {
      new: true,
      runValidators: true,
    });
    // Se relee con getById para devolver siempre las relaciones ya resueltas.
    return this.getById(id);
  }

  /**
   * Insercion masiva para la carga de datos de prueba.
   * `ordered: false` deja que el lote siga aunque un documento choque contra un
   * indice unico, en vez de abortar toda la carga por uno solo.
   */
  async createMany(documents = []) {
    if (documents.length === 0) return [];
    // Sin `lean`: se necesita que Mongoose aplique defaults (isActive, status) y
    // valide los enums de cada documento antes de escribirlo.
    const inserted = await this.model.insertMany(documents, { ordered: false });
    return inserted.map((doc) => doc.toObject());
  }

  /** Borra fisicamente solo los pedidos marcados como simulados. */
  async deleteMocks() {
    const { deletedCount } = await this.model.deleteMany({ isMock: true });
    return deletedCount;
  }
}

module.exports = new OrderRepository();
module.exports.OrderRepository = OrderRepository;
