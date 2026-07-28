/**
 * ProductService - reglas de negocio del catalogo.
 *
 * Es el unico que decide: que se puede crear, quien puede hacerlo, como se
 * deriva el estado de un producto a partir del stock y como se calculan
 * totales. Habla con el Repository, nunca con Mongoose.
 */
const productRepository = require('../repositories/product.repository');
const AppError = require('../utils/AppError');
const {
  PRODUCT_STATUS,
  PRODUCT_CATEGORIES,
  USER_ROLES,
  ERROR_MESSAGES,
  PAGINATION,
  SORT_ORDER,
} = require('../constants');
const { config } = require('../config');

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
      throw AppError.forbidden(ERROR_MESSAGES.FORBIDDEN_ROLE);
    }
  }

  /** Normaliza y valida los parametros de listado que llegan como string. */
  #normalizeQuery(query = {}) {
    const page = Math.max(Number.parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE, 1);
    const requestedLimit = Number.parseInt(query.limit, 10) || config.defaultPageSize;
    const limit = Math.min(Math.max(requestedLimit, 1), PAGINATION.MAX_LIMIT);

    const filter = {};

    if (query.category) {
      if (!Object.values(PRODUCT_CATEGORIES).includes(query.category)) {
        throw AppError.badRequest(
          `Categoria invalida. Valores admitidos: ${Object.values(PRODUCT_CATEGORIES).join(', ')}`
        );
      }
      filter.category = query.category;
    }

    if (query.status) {
      if (!Object.values(PRODUCT_STATUS).includes(query.status)) {
        throw AppError.badRequest(
          `Estado invalido. Valores admitidos: ${Object.values(PRODUCT_STATUS).join(', ')}`
        );
      }
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
      throw AppError.badRequest(`Faltan campos obligatorios: ${missing.join(', ')}`);
    }

    const price = Number(data.price);
    if (!Number.isFinite(price) || price < 0) {
      throw AppError.badRequest('El precio debe ser un numero mayor o igual a 0');
    }
    data.price = price;

    const stock = data.stock === undefined ? 0 : Number(data.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      throw AppError.badRequest('El stock debe ser un entero mayor o igual a 0');
    }
    data.stock = stock;

    if (data.category !== undefined && !Object.values(PRODUCT_CATEGORIES).includes(data.category)) {
      throw AppError.badRequest(
        `Categoria invalida. Valores admitidos: ${Object.values(PRODUCT_CATEGORIES).join(', ')}`
      );
    }

    if (data.thumbnails !== undefined && !Array.isArray(data.thumbnails)) {
      throw AppError.badRequest('thumbnails debe ser un array de URLs');
    }

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
    if (!product) throw AppError.notFound(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
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
    if (existing) throw AppError.conflict(ERROR_MESSAGES.PRODUCT_CODE_IN_USE);

    data.status = this.#resolveStatus(data.stock);

    return this.repository.create(data);
  }

  /** Actualizacion parcial. El estado se recalcula si cambia el stock. */
  async update(id, payload, requesterRole) {
    this.#assertCanManage(requesterRole);

    const current = await this.repository.getById(id);
    if (!current) throw AppError.notFound(ERROR_MESSAGES.PRODUCT_NOT_FOUND);

    const changes = {};

    if (payload.title !== undefined) changes.title = String(payload.title).trim();
    if (payload.description !== undefined) changes.description = String(payload.description).trim();
    if (payload.thumbnails !== undefined) {
      if (!Array.isArray(payload.thumbnails)) throw AppError.badRequest('thumbnails debe ser un array de URLs');
      changes.thumbnails = payload.thumbnails;
    }

    if (payload.price !== undefined) {
      const price = Number(payload.price);
      if (!Number.isFinite(price) || price < 0) {
        throw AppError.badRequest('El precio debe ser un numero mayor o igual a 0');
      }
      changes.price = price;
    }

    if (payload.stock !== undefined) {
      const stock = Number(payload.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        throw AppError.badRequest('El stock debe ser un entero mayor o igual a 0');
      }
      changes.stock = stock;
    }

    if (payload.category !== undefined) {
      if (!Object.values(PRODUCT_CATEGORIES).includes(payload.category)) {
        throw AppError.badRequest(
          `Categoria invalida. Valores admitidos: ${Object.values(PRODUCT_CATEGORIES).join(', ')}`
        );
      }
      changes.category = payload.category;
    }

    if (payload.status !== undefined) {
      if (!Object.values(PRODUCT_STATUS).includes(payload.status)) {
        throw AppError.badRequest(
          `Estado invalido. Valores admitidos: ${Object.values(PRODUCT_STATUS).join(', ')}`
        );
      }
      changes.status = payload.status;
    }

    if (payload.code !== undefined) {
      const code = String(payload.code).trim().toUpperCase();
      if (code !== current.code) {
        const duplicated = await this.repository.getByCode(code, { includeInactive: true });
        if (duplicated) throw AppError.conflict(ERROR_MESSAGES.PRODUCT_CODE_IN_USE);
        changes.code = code;
      }
    }

    if (Object.keys(changes).length === 0) {
      throw AppError.badRequest('No se enviaron campos validos para actualizar');
    }

    // El estado se recalcula salvo que el cliente lo haya fijado a mano.
    if (changes.stock !== undefined && changes.status === undefined) {
      changes.status = this.#resolveStatus(changes.stock, current.status);
    }

    const updated = await this.repository.update(id, changes);
    if (!updated) throw AppError.notFound(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    return updated;
  }

  /**
   * Descuenta stock por una compra. Es el caso de uso mas sensible: se resuelve
   * con un update atomico en el Repository para evitar sobreventa.
   */
  async decreaseStock(id, quantity) {
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw AppError.badRequest('La cantidad debe ser un entero mayor a 0');
    }

    const product = await this.repository.getById(id);
    if (!product) throw AppError.notFound(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    if (product.status === PRODUCT_STATUS.DISCONTINUED) {
      throw AppError.conflict(ERROR_MESSAGES.PRODUCT_DISCONTINUED);
    }

    const updated = await this.repository.adjustStock(id, -amount);
    if (!updated) throw AppError.conflict(ERROR_MESSAGES.INSUFFICIENT_STOCK);

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
    if (!deleted) throw AppError.notFound(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
    return deleted;
  }
}

module.exports = new ProductService();
module.exports.ProductService = ProductService;
