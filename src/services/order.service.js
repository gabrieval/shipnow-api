/**
 * OrderService - reglas de negocio de pedidos.
 *
 * Los pedidos se crean desde el modulo de mocking; lo que expone la API es la
 * consulta y el avance de estado, que es donde viven las reglas: no todo estado
 * puede pasar a cualquier otro y un pedido cancelado no vuelve atras.
 */
const orderRepository = require('../repositories/order.repository');
const {
  ForbiddenRoleError,
  OrderNotFoundError,
  InvalidOrderStatusError,
  InvalidOrderPriorityError,
  ValidationError,
} = require('../errors');
const { ORDER_STATUS, ORDER_PRIORITY, USER_ROLES, PAGINATION, SORT_ORDER } = require('../constants');
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
  constructor(repository = orderRepository) {
    this.repository = repository;
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
