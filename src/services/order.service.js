/**
 * OrderService - reglas de negocio de pedidos.
 *
 * Los pedidos se crean desde el modulo de mocking; lo que expone la API es la
 * consulta y el avance de estado, que es donde viven las reglas: no todo estado
 * puede pasar a cualquier otro y un pedido cancelado no vuelve atras.
 */
const orderRepository = require('../repositories/order.repository');
const userRepository = require('../repositories/user.repository');
const fileService = require('./file.service');
const productRepository = require('../repositories/product.repository');
const {
  ForbiddenRoleError,
  OrderNotFoundError,
  InvalidOrderStatusError,
  InvalidOrderPriorityError,
  ProductNotFoundError,
  InsufficientStockError,
  UserNotFoundError,
  ValidationError,
} = require('../errors');
const {
  ORDER_STATUS,
  ORDER_PRIORITY,
  USER_ROLES,
  FILE_OWNER_TYPES,
  UPLOAD_RULES,
  PAGINATION,
  SORT_ORDER,
} = require('../constants');
const { config, logger } = require('../config');

const SORTABLE_FIELDS = ['createdAt', 'total', 'status', 'priority'];

/**
 * Transiciones permitidas del ciclo de vida de un pedido.
 * Un pedido entregado o cancelado es terminal: no admite mas cambios.
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
});

class OrderService {
  constructor(repository = orderRepository, users = userRepository, products = productRepository) {
    this.repository = repository;
    this.userRepository = users;
    this.productRepository = products;
  }

  // --- Helpers de dominio --------------------------------------------------

  #assertIsAdmin(requesterRole) {
    if (requesterRole !== USER_ROLES.ADMIN) {
      throw new ForbiddenRoleError({ requiredRole: USER_ROLES.ADMIN, receivedRole: requesterRole });
    }
  }

  #assertValidStatus(status) {
    if (!Object.values(ORDER_STATUS).includes(status)) {
      throw new InvalidOrderStatusError(status, Object.values(ORDER_STATUS));
    }
  }

  #assertValidPriority(priority) {
    if (!Object.values(ORDER_PRIORITY).includes(priority)) {
      throw new InvalidOrderPriorityError(priority, Object.values(ORDER_PRIORITY));
    }
  }

  /** Valida que el salto de estado sea uno de los permitidos. */
  #assertTransitionIsAllowed(current, next) {
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new InvalidOrderStatusError(next, allowed.length > 0 ? allowed : ['(estado terminal, no admite cambios)']);
    }
  }

  #normalizeQuery(query = {}) {
    const page = Math.max(Number.parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE, 1);
    const requestedLimit = Number.parseInt(query.limit, 10) || config.defaultPageSize;
    const limit = Math.min(Math.max(requestedLimit, 1), PAGINATION.MAX_LIMIT);

    const filter = {};

    if (query.status) {
      this.#assertValidStatus(query.status);
      filter.status = query.status;
    }

    if (query.priority) {
      this.#assertValidPriority(query.priority);
      filter.priority = query.priority;
    }

    if (query.user) filter.user = query.user;

    const sortBy = SORTABLE_FIELDS.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const order = query.order === SORT_ORDER.ASC ? SORT_ORDER.ASC : SORT_ORDER.DESC;

    return { filter, page, limit, sortBy, order };
  }

  // --- Casos de uso --------------------------------------------------------

  /** Listado paginado. Devuelve tambien cuanto facturan los pedidos listados. */
  async getAll(query = {}) {
    const { filter, page, limit, sortBy, order } = this.#normalizeQuery(query);
    const result = await this.repository.getAll({ filter, page, limit, sortBy, order });

    // Calculo de negocio: el repositorio solo trae documentos.
    const billed = result.docs.reduce((acc, doc) => acc + doc.total, 0);

    return {
      orders: result.docs,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasPrevPage: result.page > 1,
        hasNextPage: result.page < result.totalPages,
      },
      summary: { billedAmount: Number(billed.toFixed(2)) },
    };
  }

  async getById(id) {
    const order = await this.repository.getById(id);
    if (!order) throw new OrderNotFoundError(id);
    return order;
  }

  /**
   * Alta de pedido.
   *
   * Es el caso de uso mas pesado del service porque cruza tres entidades:
   *  - El usuario tiene que existir.
   *  - Cada producto tiene que existir y tener stock suficiente.
   *  - El total NO llega del cliente: se calcula con el precio vigente de cada
   *    producto al momento de la compra.
   *
   * El stock se descuenta de forma atomica producto por producto. Si alguno
   * falla a mitad de camino se devuelven los ya descontados, para no dejar el
   * catalogo inconsistente por un pedido que nunca se creo.
   *
   * @param {object} payload datos crudos del request
   */
  async create(payload = {}) {
    const { user, items, shippingAddress, priority, notes } = payload;

    // --- Validacion de forma ---
    const missing = ['user', 'items', 'shippingAddress'].filter((field) => payload[field] === undefined);
    if (missing.length > 0) {
      throw new ValidationError(
        missing.map((field) => ({ field, message: 'Es obligatorio' })),
        `Faltan campos obligatorios: ${missing.join(', ')}`
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError([{ field: 'items', message: 'Debe ser un array con al menos un item' }]);
    }

    for (const [index, item] of items.entries()) {
      if (!item || item.product === undefined) {
        throw new ValidationError([{ field: `items[${index}].product`, message: 'Es obligatorio' }]);
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new ValidationError([
          { field: `items[${index}].quantity`, message: 'Debe ser un entero mayor a 0', received: item.quantity },
        ]);
      }
    }

    for (const field of ['street', 'city', 'country']) {
      if (!shippingAddress?.[field]) {
        throw new ValidationError([{ field: `shippingAddress.${field}`, message: 'Es obligatorio' }]);
      }
    }

    if (priority !== undefined) this.#assertValidPriority(priority);

    // --- Validacion contra el dominio ---
    const owner = await this.userRepository.getById(user);
    if (!owner) throw new UserNotFoundError(user);

    // Una sola consulta para todos los productos del pedido, en vez de una por item.
    const catalogo = await this.productRepository.getManyByIds(items.map((item) => item.product));

    const resolved = [];
    for (const item of items) {
      const product = catalogo.get(String(item.product));
      if (!product) throw new ProductNotFoundError(item.product);

      const quantity = Number(item.quantity);
      if (product.stock < quantity) {
        throw new InsufficientStockError({ requested: quantity, available: product.stock });
      }

      resolved.push({
        product: product._id,
        title: product.title,
        quantity,
        unitPrice: product.price,
        subtotal: Number((product.price * quantity).toFixed(2)),
      });
    }

    // --- Descuento de stock con compensacion si algo falla ---
    const descontados = [];
    try {
      for (const item of resolved) {
        const updated = await this.productRepository.adjustStock(item.product, -item.quantity);
        if (!updated) throw new InsufficientStockError({ requested: item.quantity });
        descontados.push(item);
      }
    } catch (error) {
      for (const item of descontados) {
        await this.productRepository.adjustStock(item.product, item.quantity);
      }
      logger.warning('Se revirtio el descuento de stock de un pedido que no se pudo crear', {
        revertidos: descontados.length,
        motivo: error.message,
      });
      throw error;
    }

    const total = Number(resolved.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2));

    const created = await this.repository.create({
      code: this.#generateCode(),
      user: owner._id,
      items: resolved,
      total,
      status: ORDER_STATUS.PENDING,
      priority: priority ?? ORDER_PRIORITY.NORMAL,
      shippingAddress,
      notes: notes ?? '',
    });

    logger.info('Pedido creado', { code: created.code, usuario: owner.email, items: resolved.length, total });

    return created;
  }

  /**
   * Adjunta un comprobante de pago al pedido.
   * Si el pedido no existe, el archivo recien subido se borra.
   */
  async uploadReceipt(id, file) {
    fileService.assertFileExists(file, UPLOAD_RULES.FIELDS.RECEIPT);

    return fileService.withRollback(file, async () => {
      const order = await this.repository.getById(id);
      if (!order) throw new OrderNotFoundError(id);

      const metadata = fileService.buildMetadata(file);
      const updated = await this.repository.addReceipt(id, metadata);

      fileService.logUpload({ ownerType: FILE_OWNER_TYPES.ORDER, ownerId: id, metadata });

      return {
        order: updated,
        receipt: updated.receipts[updated.receipts.length - 1],
      };
    });
  }

  /** Codigo legible y unico para el pedido. */
  #generateCode() {
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `ORD-${Date.now().toString(36).toUpperCase()}-${random}`;
  }

  /** Avance de estado del pedido. Solo ADMIN, y solo por transiciones validas. */
  async updateStatus(id, status, requesterRole) {
    this.#assertIsAdmin(requesterRole);

    if (status === undefined) {
      throw new ValidationError([{ field: 'status', message: 'Es obligatorio' }]);
    }
    this.#assertValidStatus(status);

    const order = await this.repository.getById(id);
    if (!order) throw new OrderNotFoundError(id);

    this.#assertTransitionIsAllowed(order.status, status);

    const updated = await this.repository.update(id, { status });
    logger.info('Estado de pedido actualizado', { code: order.code, anterior: order.status, nuevo: status });

    return updated;
  }
}

module.exports = new OrderService();
module.exports.OrderService = OrderService;
