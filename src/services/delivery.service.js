/**
 * DeliveryService - reglas de negocio de entregas.
 *
 * La regla central es la coherencia entrega <-> repartidor: hay estados que no
 * se pueden sostener sin alguien asignado, y el repartidor tiene que ser un
 * usuario con rol COURIER. Es la misma regla que respeta el modulo de mocking,
 * aplicada ahora sobre datos reales.
 */
const deliveryRepository = require('../repositories/delivery.repository');
const userRepository = require('../repositories/user.repository');
const fileService = require('./file.service');
const {
  ForbiddenRoleError,
  DeliveryNotFoundError,
  InvalidDeliveryStatusError,
  InvalidRoleError,
  UserNotFoundError,
  ValidationError,
} = require('../errors');
const {
  DELIVERY_STATUS,
  DELIVERY_STATUS_REQUIRING_COURIER,
  USER_ROLES,
  FILE_OWNER_TYPES,
  UPLOAD_RULES,
  PAGINATION,
  SORT_ORDER,
} = require('../constants');
const { config, logger } = require('../config');

const SORTABLE_FIELDS = ['createdAt', 'estimatedDate', 'status'];

class DeliveryService {
  constructor(repository = deliveryRepository, users = userRepository) {
    this.repository = repository;
    this.userRepository = users;
  }

  // --- Helpers de dominio --------------------------------------------------

  #assertIsAdmin(requesterRole) {
    if (requesterRole !== USER_ROLES.ADMIN) {
      throw new ForbiddenRoleError({ requiredRole: USER_ROLES.ADMIN, receivedRole: requesterRole });
    }
  }

  #assertValidStatus(status) {
    if (!Object.values(DELIVERY_STATUS).includes(status)) {
      throw new InvalidDeliveryStatusError(status, Object.values(DELIVERY_STATUS));
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

    if (query.courier) filter.courier = query.courier;

    // Filtro de conveniencia para el tablero de despacho.
    if (String(query.unassigned) === 'true') filter.courier = null;

    const sortBy = SORTABLE_FIELDS.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const order = query.order === SORT_ORDER.ASC ? SORT_ORDER.ASC : SORT_ORDER.DESC;

    return { filter, page, limit, sortBy, order };
  }

  // --- Casos de uso --------------------------------------------------------

  async getAll(query = {}) {
    const { filter, page, limit, sortBy, order } = this.#normalizeQuery(query);
    const result = await this.repository.getAll({ filter, page, limit, sortBy, order });

    const sinAsignar = result.docs.filter((delivery) => !delivery.courier).length;

    return {
      deliveries: result.docs,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasPrevPage: result.page > 1,
        hasNextPage: result.page < result.totalPages,
      },
      summary: { pendingAssignment: sinAsignar },
    };
  }

  async getById(id) {
    const delivery = await this.repository.getById(id);
    if (!delivery) throw new DeliveryNotFoundError(id);
    return delivery;
  }

  /**
   * Seguimiento publico de una entrega por su codigo de tracking.
   * No expone nada que no devuelva ya `GET /deliveries/:did`.
   */
  async getByTrackingCode(code) {
    if (code === undefined || String(code).trim() === '') {
      throw new ValidationError([{ field: 'code', message: 'Es obligatorio' }]);
    }

    const delivery = await this.repository.getByTrackingCode(code);
    if (!delivery) throw new DeliveryNotFoundError(code);

    return delivery;
  }

  /**
   * Cambia el estado de la entrega.
   * Regla: no se puede pasar a un estado que exige repartidor si la entrega no
   * tiene uno asignado.
   */
  async updateStatus(id, status, requesterRole) {
    this.#assertIsAdmin(requesterRole);

    if (status === undefined) {
      throw new ValidationError([{ field: 'status', message: 'Es obligatorio' }]);
    }
    this.#assertValidStatus(status);

    const delivery = await this.repository.getById(id);
    if (!delivery) throw new DeliveryNotFoundError(id);

    if (DELIVERY_STATUS_REQUIRING_COURIER.includes(status) && !delivery.courier) {
      throw new InvalidDeliveryStatusError(status, [DELIVERY_STATUS.PENDING_ASSIGNMENT]);
    }

    const changes = { status };
    if (status === DELIVERY_STATUS.DELIVERED) changes.deliveredAt = new Date();

    const updated = await this.repository.update(id, changes);
    logger.info('Estado de entrega actualizado', {
      trackingCode: delivery.trackingCode,
      anterior: delivery.status,
      nuevo: status,
    });

    return updated;
  }

  /**
   * Adjunta un comprobante de entrega (la constancia de que el pedido llego).
   * Si la entrega no existe, el archivo recien subido se borra.
   */
  async uploadReceipt(id, file) {
    fileService.assertFileExists(file, UPLOAD_RULES.FIELDS.RECEIPT);

    return fileService.withRollback(file, async () => {
      const delivery = await this.repository.getById(id);
      if (!delivery) throw new DeliveryNotFoundError(id);

      const metadata = fileService.buildMetadata(file);
      const updated = await this.repository.addReceipt(id, metadata);

      fileService.logUpload({ ownerType: FILE_OWNER_TYPES.DELIVERY, ownerId: id, metadata });

      return {
        delivery: updated,
        receipt: updated.receipts[updated.receipts.length - 1],
      };
    });
  }

  /** Asigna un repartidor. El usuario elegido tiene que tener rol COURIER. */
  async assignCourier(id, courierId, requesterRole) {
    this.#assertIsAdmin(requesterRole);

    if (courierId === undefined) {
      throw new ValidationError([{ field: 'courier', message: 'Es obligatorio' }]);
    }

    const delivery = await this.repository.getById(id);
    if (!delivery) throw new DeliveryNotFoundError(id);

    const courier = await this.userRepository.getById(courierId);
    if (!courier) throw new UserNotFoundError(courierId);
    if (courier.role !== USER_ROLES.COURIER) {
      throw new InvalidRoleError(courier.role, [USER_ROLES.COURIER]);
    }

    const updated = await this.repository.update(id, {
      courier: courierId,
      status: DELIVERY_STATUS.ASSIGNED,
      assignedAt: new Date(),
    });

    logger.info('Repartidor asignado a una entrega', {
      trackingCode: delivery.trackingCode,
      courier: courier.email,
    });

    return updated;
  }
}

module.exports = new DeliveryService();
module.exports.DeliveryService = DeliveryService;
