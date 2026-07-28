/**
 * Diccionario unico de valores inmutables del dominio.
 *
 * Regla del proyecto: ninguna capa escribe strings sueltos como 'admin' o
 * 'available'. Todo valor que el dominio considere "fijo" vive aca, congelado
 * con Object.freeze para que no pueda mutarse en runtime por accidente.
 */

/** Roles de usuario. Se usan en el modelo, en el service y en los permisos. */
const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  USER: 'user',
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

/** Mensajes de error reutilizables, para no duplicar textos entre services. */
const ERROR_MESSAGES = Object.freeze({
  PRODUCT_NOT_FOUND: 'El producto solicitado no existe',
  PRODUCT_CODE_IN_USE: 'Ya existe un producto con ese codigo',
  PRODUCT_DISCONTINUED: 'El producto esta discontinuado y no admite operaciones de stock',
  INSUFFICIENT_STOCK: 'Stock insuficiente para completar la operacion',
  USER_NOT_FOUND: 'El usuario solicitado no existe',
  USER_EMAIL_IN_USE: 'Ya existe un usuario registrado con ese email',
  INVALID_CREDENTIALS: 'Email o contrasena incorrectos',
  INVALID_ID: 'El identificador enviado no es valido',
  FORBIDDEN_ROLE: 'No tenes permisos para realizar esta accion',
  LAST_ADMIN: 'No se puede degradar ni eliminar al ultimo administrador',
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
  HTTP_STATUS,
  ERROR_MESSAGES,
  PAGINATION,
  SORT_ORDER,
};
