/**
 * ProductService - reglas de negocio del catalogo.
 *
 * Es el unico que decide: que se puede crear, quien puede hacerlo, como se
 * deriva el estado de un producto a partir del stock y como se calculan
 * totales. Habla con el Repository, nunca con Mongoose.
 *
 * Manejo de errores: detecta el problema y lanza el error de dominio que
 * corresponde. No arma respuestas HTTP ni elige status codes; de eso se ocupa
 * el middleware global.
 */
const productRepository = require('../repositories/product.repository');
const {
  ValidationError,
  ForbiddenRoleError,
  ProductNotFoundError,
  ProductCodeInUseError,
  ProductDiscontinuedError,
  InsufficientStockError,
  InvalidProductStatusError,
  InvalidProductCategoryError,
} = require('../errors');
const { PRODUCT_STATUS, PRODUCT_CATEGORIES, USER_ROLES, PAGINATION, SORT_ORDER } = require('../constants');
const { config, logger } = require('../config');

/** Campos que el cliente puede enviar. Cualquier otro se descarta. */
const CREATABLE_FIELDS = ['title', 'description', 'code', 'price', 'stock', 'category', 'thumbnails'];
const SORTABLE_FIELDS = ['createdAt', 'price', 'stock', 'title'];

class ProductService {
  constructor(repository = productRepository) {
    this.repository = repository;
  }

  // --- Helpers de dominio --------------------------------------------------

  /**
   * Regla de negocio: el estado de un producto se deriva del stock, salvo que
   * este discontinuado (decision manual que sobrescribe el calculo).
   */
  #resolveStatus(stock, currentStatus) {
    if (currentStatus === PRODUCT_STATUS.DISCONTINUED) return PRODUCT_STATUS.DISCONTINUED;
    return stock > 0 ? PRODUCT_STATUS.AVAILABLE : PRODUCT_STATUS.OUT_OF_STOCK;
  }

  /** Solo un ADMIN modifica el catalogo. */
  #assertCanManage(requesterRole) {
    if (requesterRole !== USER_ROLES.ADMIN) {
      throw new ForbiddenRoleError({ requiredRole: USER_ROLES.ADMIN, receivedRole: requesterRole });
    }
  }

  /** Valida la categoria contra las constantes del dominio. */
  #assertValidCategory(category) {
    if (!Object.values(PRODUCT_CATEGORIES).includes(category)) {
      throw new InvalidProductCategoryError(category, Object.values(PRODUCT_CATEGORIES));
    }
  }

  /** Valida el estado contra las constantes del dominio. */
  #assertValidStatus(status) {
    if (!Object.values(PRODUCT_STATUS).includes(status)) {
      throw new InvalidProductStatusError(status, Object.values(PRODUCT_STATUS));
    }
  }

  /** Precio: numero finito y no negativo. */
  #parsePrice(value) {
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) {
      throw new ValidationError([{ field: 'price', message: 'Debe ser un numero mayor o igual a 0', received: value }]);
    }
    return price;
  }

  /** Stock: entero y no negativo. */
  #parseStock(value) {
    const stock = Number(value);
    if (!Number.isInteger(stock) || stock < 0) {
      throw new ValidationError([{ field: 'stock', message: 'Debe ser un entero mayor o igual a 0', received: value }]);
    }
    return stock;
  }

  #assertValidThumbnails(value) {
    if (!Array.isArray(value)) {
      throw new ValidationError([{ field: 'thumbnails', message: 'Debe ser un array de URLs', received: value }]);
    }
  }

  /** Normaliza y valida los parametros de listado que llegan como string. */
  #normalizeQuery(query = {}) {
    const page = Math.max(Number.parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE, 1);
    const requestedLimit = Number.parseInt(query.limit, 10) || config.defaultPageSize;
    const limit = Math.min(Math.max(requestedLimit, 1), PAGINATION.MAX_LIMIT);

    const filter = {};

    if (query.category) {
      this.#assertValidCategory(query.category);
      filter.category = query.category;
    }

    if (query.status) {
      this.#assertValidStatus(query.status);
      filter.status = query.status;
    }

    // Filtro de conveniencia: ?available=true oculta lo que no se puede vender.
    if (String(query.available) === 'true') {
      filter.status = PRODUCT_STATUS.AVAILABLE;
      filter.stock = { $gt: 0 };
    }

    const sortBy = SORTABLE_FIELDS.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const order = query.order === SORT_ORDER.ASC ? SORT_ORDER.ASC : SORT_ORDER.DESC;

    return { filter, page, limit, sortBy, order };
  }

  /** Valida el payload de alta y devuelve solo los campos permitidos. */
  #sanitizeCreatePayload(payload = {}) {
    const data = {};
    for (const field of CREATABLE_FIELDS) {
      if (payload[field] !== undefined) data[field] = payload[field];
    }

    const missing = ['title', 'description', 'code', 'price'].filter(
      (field) => data[field] === undefined || String(data[field]).trim() === ''
    );
    if (missing.length > 0) {
      throw new ValidationError(
        missing.map((field) => ({ field, message: 'Es obligatorio' })),
        `Faltan campos obligatorios: ${missing.join(', ')}`
      );
    }

    data.price = this.#parsePrice(data.price);
    data.stock = data.stock === undefined ? 0 : this.#parseStock(data.stock);

    if (data.category !== undefined) this.#assertValidCategory(data.category);
    if (data.thumbnails !== undefined) this.#assertValidThumbnails(data.thumbnails);

    return data;
  }

  // --- Casos de uso --------------------------------------------------------

  /** Listado paginado. Devuelve tambien el valor total del inventario listado. */
  async getAll(query = {}) {
    const { filter, page, limit, sortBy, order } = this.#normalizeQuery(query);
    const result = await this.repository.getAll({ filter, page, limit, sortBy, order });

    // Calculo de negocio: no lo hace el Repository.
    const inventoryValue = result.docs.reduce((acc, product) => acc + product.price * product.stock, 0);

    return {
      products: result.docs,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasPrevPage: result.page > 1,
        hasNextPage: result.page < result.totalPages,
      },
      summary: {
        inventoryValue: Number(inventoryValue.toFixed(2)),
      },
    };
  }

  /** Atajo de catalogo publico: solo lo que tiene stock disponible. */
  async getAvailable(query = {}) {
    return this.getAll({ ...query, available: 'true' });
  }

  async getById(id) {
    const product = await this.repository.getById(id);
    if (!product) throw new ProductNotFoundError(id);
    return product;
  }

  /**
   * Alta de producto.
   * @param {object} payload datos crudos del request
   * @param {string} requesterRole rol de quien ejecuta la accion
   */
  async create(payload, requesterRole) {
    this.#assertCanManage(requesterRole);

    const data = this.#sanitizeCreatePayload(payload);
    data.code = String(data.code).trim().toUpperCase();

    const existing = await this.repository.getByCode(data.code, { includeInactive: true });
    if (existing) throw new ProductCodeInUseError(data.code);

    data.status = this.#resolveStatus(data.stock);

    const created = await this.repository.create(data);
    logger.info('Producto creado', { id: String(created._id), code: created.code, status: created.status });

    return created;
  }

  /** Actualizacion parcial. El estado se recalcula si cambia el stock. */
  async update(id, payload, requesterRole) {
    this.#assertCanManage(requesterRole);

    const current = await this.repository.getById(id);
    if (!current) throw new ProductNotFoundError(id);

    const changes = {};

    if (payload.title !== undefined) changes.title = String(payload.title).trim();
    if (payload.description !== undefined) changes.description = String(payload.description).trim();

    if (payload.thumbnails !== undefined) {
      this.#assertValidThumbnails(payload.thumbnails);
      changes.thumbnails = payload.thumbnails;
    }

    if (payload.price !== undefined) changes.price = this.#parsePrice(payload.price);
    if (payload.stock !== undefined) changes.stock = this.#parseStock(payload.stock);

    if (payload.category !== undefined) {
      this.#assertValidCategory(payload.category);
      changes.category = payload.category;
    }

    if (payload.status !== undefined) {
      this.#assertValidStatus(payload.status);
      changes.status = payload.status;
    }

    if (payload.code !== undefined) {
      const code = String(payload.code).trim().toUpperCase();
      if (code !== current.code) {
        const duplicated = await this.repository.getByCode(code, { includeInactive: true });
        if (duplicated) throw new ProductCodeInUseError(code);
        changes.code = code;
      }
    }

    if (Object.keys(changes).length === 0) {
      throw new ValidationError(
        { allowedFields: CREATABLE_FIELDS.concat('status') },
        'No se enviaron campos validos para actualizar'
      );
    }

    // El estado se recalcula salvo que el cliente lo haya fijado a mano.
    if (changes.stock !== undefined && changes.status === undefined) {
      changes.status = this.#resolveStatus(changes.stock, current.status);
    }

    const updated = await this.repository.update(id, changes);
    if (!updated) throw new ProductNotFoundError(id);
    return updated;
  }

  /**
   * Descuenta stock por una compra. Es el caso de uso mas sensible: se resuelve
   * con un update atomico en el Repository para evitar sobreventa.
   */
  async decreaseStock(id, quantity) {
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError([
        { field: 'quantity', message: 'Debe ser un entero mayor a 0', received: quantity },
      ]);
    }

    const product = await this.repository.getById(id);
    if (!product) throw new ProductNotFoundError(id);
    if (product.status === PRODUCT_STATUS.DISCONTINUED) {
      throw new ProductDiscontinuedError(product.code);
    }

    const updated = await this.repository.adjustStock(id, -amount);
    // El update atomico devuelve null si el filtro `stock >= amount` no se cumplio.
    if (!updated) throw new InsufficientStockError({ requested: amount, available: product.stock });

    logger.debug('Stock descontado', { code: updated.code, descontado: amount, restante: updated.stock });
    if (updated.stock === 0) logger.warning('Producto sin stock disponible', { code: updated.code });

    // Tras descontar, el estado puede haber cambiado a sin stock.
    const nextStatus = this.#resolveStatus(updated.stock, updated.status);
    if (nextStatus !== updated.status) {
      return this.repository.update(id, { status: nextStatus });
    }

    return updated;
  }

  /** Baja logica del producto. Solo ADMIN. */
  async delete(id, requesterRole) {
    this.#assertCanManage(requesterRole);

    const deleted = await this.repository.softDelete(id);
    if (!deleted) throw new ProductNotFoundError(id);

    logger.info('Producto dado de baja', { id: String(id), code: deleted.code });
    return deleted;
  }
}

module.exports = new ProductService();
module.exports.ProductService = ProductService;
