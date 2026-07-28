/**
 * ProductRepository - unico modulo que habla Mongoose para la entidad Product.
 *
 * Responsabilidad: acceso a datos. Encapsula filtros por defecto (baja logica),
 * proyecciones, paginacion y traduccion de errores de driver. No decide reglas
 * de negocio: no calcula totales, no valida permisos, no arma respuestas HTTP.
 */
const mongoose = require('mongoose');
const ProductModel = require('../models/product.model');
const { SORT_ORDER } = require('../constants');

/** Campos que salen del repositorio hacia el service. `isActive` es interno. */
const PUBLIC_PROJECTION = 'title description code price stock category status thumbnails createdAt updatedAt';

/** Filtro base: el resto de la app nunca ve productos dados de baja. */
const BASE_FILTER = Object.freeze({ isActive: true });

class ProductRepository {
  constructor(model = ProductModel) {
    this.model = model;
  }

  /** Combina el filtro base con el filtro puntual de la consulta. */
  #withBaseFilter(filter = {}) {
    return { ...BASE_FILTER, ...filter };
  }

  /** Traduce un ordenamiento declarativo a la sintaxis de Mongoose. */
  #buildSort({ sortBy = 'createdAt', order = SORT_ORDER.DESC } = {}) {
    return { [sortBy]: order === SORT_ORDER.ASC ? 1 : -1 };
  }

  /** True si el string tiene forma de ObjectId. Evita que un id basura llegue al driver. */
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

  /**
   * Listado paginado con filtros ya normalizados por el Service.
   * @returns {Promise<{docs: object[], total: number, page: number, limit: number, totalPages: number}>}
   */
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

  /** Busca un producto activo por id. Devuelve null si no existe. */
  async getById(id) {
    if (!this.isValidId(id)) return null;
    return this.model.findOne(this.#withBaseFilter({ _id: id }), PUBLIC_PROJECTION).lean();
  }

  /**
   * Busca por codigo de catalogo.
   * @param {string} code
   * @param {{includeInactive?: boolean}} [options] los codigos son unicos incluso
   *   entre productos dados de baja, por eso el chequeo de duplicados los incluye.
   */
  async getByCode(code, { includeInactive = false } = {}) {
    const filter = includeInactive ? { code } : this.#withBaseFilter({ code });
    return this.model.findOne(filter, PUBLIC_PROJECTION).lean();
  }

  /** Cuenta documentos activos que matcheen el filtro. */
  async countBy(filter = {}) {
    return this.model.countDocuments(this.#withBaseFilter(filter));
  }

  /** Inserta un producto ya validado por el Service. */
  async create(data) {
    const created = await this.model.create(data);
    return this.getById(created._id);
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

  /** Borra fisicamente solo los productos marcados como simulados. */
  async deleteMocks() {
    const { deletedCount } = await this.model.deleteMany({ isMock: true });
    return deletedCount;
  }

  /** Actualiza campos puntuales y devuelve el documento resultante. */
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

  /**
   * Ajuste atomico de stock. La condicion `stock >= -delta` va en el filtro para
   * que dos pedidos simultaneos no dejen el stock en negativo.
   * @param {string} id
   * @param {number} delta positivo suma, negativo descuenta
   */
  async adjustStock(id, delta) {
    if (!this.isValidId(id)) return null;

    const filter = this.#withBaseFilter({ _id: id });
    if (delta < 0) filter.stock = { $gte: Math.abs(delta) };

    return this.model
      .findOneAndUpdate(filter, { $inc: { stock: delta } }, {
        new: true,
        projection: PUBLIC_PROJECTION,
      })
      .lean();
  }

  /** Baja logica: el documento queda en la base pero fuera de todas las consultas. */
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

module.exports = new ProductRepository();
module.exports.ProductRepository = ProductRepository;
