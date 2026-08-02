/**
 * Diccionario unico de valores inmutables del dominio.
 *
 * Regla del proyecto: ninguna capa escribe strings sueltos como 'admin' o
 * 'available'. Todo valor que el dominio considere "fijo" vive aca, congelado
 * con Object.freeze para que no pueda mutarse en runtime por accidente.
 */

/**
 * Roles de usuario. Se usan en el modelo, en el service y en los permisos.
 * COURIER es el repartidor: un usuario del sistema, no una entidad aparte, para
 * que una entrega pueda referenciarlo con la misma coleccion de usuarios.
 */
const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  USER: 'user',
  COURIER: 'courier',
});

/** Estados posibles de un producto dentro del catalogo. */
const PRODUCT_STATUS = Object.freeze({
  AVAILABLE: 'available',
  OUT_OF_STOCK: 'out_of_stock',
  DISCONTINUED: 'discontinued',
});

/** Categorias admitidas del catalogo de ShipNow. */
const PRODUCT_CATEGORIES = Object.freeze({
  ELECTRONICS: 'electronics',
  CLOTHING: 'clothing',
  HOME: 'home',
  SPORTS: 'sports',
  OTHER: 'other',
});

/** Estados del ciclo de vida de un pedido. */
const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

/** Prioridad de despacho de un pedido. */
const ORDER_PRIORITY = Object.freeze({
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
});

/** Estados del ciclo de vida de una entrega. */
const DELIVERY_STATUS = Object.freeze({
  PENDING_ASSIGNMENT: 'pending_assignment',
  ASSIGNED: 'assigned',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETURNED: 'returned',
});

/**
 * Estados de entrega que exigen un repartidor asignado. Se usa para mantener
 * la coherencia entrega <-> repartidor tanto en el mocking como en el dominio.
 */
const DELIVERY_STATUS_REQUIRING_COURIER = Object.freeze([
  DELIVERY_STATUS.ASSIGNED,
  DELIVERY_STATUS.IN_TRANSIT,
  DELIVERY_STATUS.DELIVERED,
  DELIVERY_STATUS.FAILED,
  DELIVERY_STATUS.RETURNED,
]);

/** Limites del modulo de mocking: evitan que un ?count desmedido tumbe la API. */
const MOCK_LIMITS = Object.freeze({
  DEFAULT_COUNT: 10,
  MAX_COUNT: 200,
  MAX_ITEMS_PER_ORDER: 5,
  /** Password en claro de todos los usuarios simulados (documentada en el README). */
  DEFAULT_PASSWORD: 'mock1234',
});

/** Codigos HTTP usados por los controllers. Evita numeros magicos en las respuestas. */
const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
});

/** Valores por defecto de paginacion, compartidos entre services. */
const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  MAX_LIMIT: 100,
});

/** Direcciones de ordenamiento admitidas en los listados. */
const SORT_ORDER = Object.freeze({
  ASC: 'asc',
  DESC: 'desc',
});

module.exports = {
  USER_ROLES,
  PRODUCT_STATUS,
  PRODUCT_CATEGORIES,
  ORDER_STATUS,
  ORDER_PRIORITY,
  DELIVERY_STATUS,
  DELIVERY_STATUS_REQUIRING_COURIER,
  MOCK_LIMITS,
  HTTP_STATUS,
  PAGINATION,
  SORT_ORDER,
};
