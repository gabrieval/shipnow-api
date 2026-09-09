/**
 * DeliveryRepository - unico modulo que habla Mongoose para la entidad Delivery.
 *
 * Resuelve las dos relaciones de la entrega (pedido y repartidor) con populate,
 * de modo que las capas de arriba nunca tengan que armar un `$lookup`.
 */
const mongoose = require('mongoose');
const DeliveryModel = require('../models/delivery.model');
const { SORT_ORDER } = require('../constants');

const PUBLIC_PROJECTION =
  'trackingCode order courier status estimatedDate assignedAt deliveredAt attempts receipts isMock createdAt updatedAt';

const BASE_FILTER = Object.freeze({ isActive: true });

const POPULATE_ORDER = { path: 'order', select: 'code status priority total user' };
const POPULATE_COURIER = { path: 'courier', select: 'firstName lastName email role' };

class DeliveryRepository {
  constructor(model = DeliveryModel) {
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

  async getAll({ filter = {}, page = 1, limit = 10, sortBy, order } = {}) {
    const query = this.#withBaseFilter(filter);
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.model
        .find(query, PUBLIC_PROJECTION)
        .populate(POPULATE_ORDER)
        .populate(POPULATE_COURIER)
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
      .populate(POPULATE_ORDER)
      .populate(POPULATE_COURIER)
      .lean();
  }

  /**
   * Busca por codigo de seguimiento. Es la via publica de consulta: el cliente
   * conoce su tracking, no el id interno de la entrega.
   */
  async getByTrackingCode(code) {
    return this.model
      .findOne(this.#withBaseFilter({ trackingCode: String(code).trim().toUpperCase() }), PUBLIC_PROJECTION)
      .populate(POPULATE_ORDER)
      .populate(POPULATE_COURIER)
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

  /** Insercion masiva para la carga de datos de prueba. */
  async createMany(documents = []) {
    if (documents.length === 0) return [];
    // Sin `lean`: se necesita que Mongoose aplique defaults (isActive, status) y
    // valide los enums de cada documento antes de escribirlo.
    const inserted = await this.model.insertMany(documents, { ordered: false });
    return inserted.map((doc) => doc.toObject());
  }

  /** Borra fisicamente solo las entregas marcadas como simuladas. */
  async deleteMocks() {
    const { deletedCount } = await this.model.deleteMany({ isMock: true });
    return deletedCount;
  }
}

module.exports = new DeliveryRepository();
module.exports.DeliveryRepository = DeliveryRepository;
