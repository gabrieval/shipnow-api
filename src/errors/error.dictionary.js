/**
 * Diccionario de errores de ShipNow.
 *
 * Fuente unica de verdad de todo lo que la API puede responder cuando algo sale
 * mal. Cada entrada define:
 *   - `status`: el codigo HTTP con el que se responde.
 *   - `message`: el mensaje por defecto que ve el cliente.
 *
 * Ninguna capa inventa mensajes ni status sueltos: los services lanzan un error
 * de dominio, ese error trae su `code`, y el middleware busca aca como
 * traducirlo. Cambiar el texto o el status de un error es cambiar una linea.
 */
const { HTTP_STATUS } = require('../constants');

const ERROR_DICTIONARY = Object.freeze({
  // --- Genericos / transversales -----------------------------------------
  VALIDATION_ERROR: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'Los datos enviados no son validos',
  },
  INVALID_ID: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'El identificador enviado no es valido',
  },
  SCHEMA_VALIDATION_ERROR: {
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: 'Los datos no cumplen con el esquema esperado',
  },
  DUPLICATED_KEY: {
    status: HTTP_STATUS.CONFLICT,
    message: 'Ya existe un registro con ese valor unico',
  },
  ROUTE_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    message: 'La ruta solicitada no existe',
  },
  FORBIDDEN_ROLE: {
    status: HTTP_STATUS.FORBIDDEN,
    message: 'No tenes permisos para realizar esta accion',
  },
  UNAUTHORIZED: {
    status: HTTP_STATUS.UNAUTHORIZED,
    message: 'No estas autenticado para realizar esta accion',
  },
  INTERNAL_ERROR: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Error interno del servidor',
  },
  DATABASE_ERROR: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Error al acceder a la base de datos',
  },

  // --- Productos ----------------------------------------------------------
  PRODUCT_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    message: 'El producto solicitado no existe',
  },
  PRODUCT_CODE_IN_USE: {
    status: HTTP_STATUS.CONFLICT,
    message: 'Ya existe un producto con ese codigo',
  },
  PRODUCT_DISCONTINUED: {
    status: HTTP_STATUS.CONFLICT,
    message: 'El producto esta discontinuado y no admite operaciones de stock',
  },
  INSUFFICIENT_STOCK: {
    status: HTTP_STATUS.CONFLICT,
    message: 'Stock insuficiente para completar la operacion',
  },
  INVALID_PRODUCT_STATUS: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'El estado de producto enviado no es valido',
  },
  INVALID_PRODUCT_CATEGORY: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'La categoria enviada no es valida',
  },

  // --- Usuarios -----------------------------------------------------------
  USER_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    message: 'El usuario solicitado no existe',
  },
  USER_EMAIL_IN_USE: {
    status: HTTP_STATUS.CONFLICT,
    message: 'Ya existe un usuario registrado con ese email',
  },
  INVALID_CREDENTIALS: {
    status: HTTP_STATUS.UNAUTHORIZED,
    message: 'Email o contrasena incorrectos',
  },
  INVALID_ROLE: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'El rol enviado no es valido',
  },
  LAST_ADMIN: {
    status: HTTP_STATUS.CONFLICT,
    message: 'No se puede degradar ni eliminar al ultimo administrador',
  },

  // --- Pedidos y entregas -------------------------------------------------
  ORDER_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    message: 'El pedido solicitado no existe',
  },
  INVALID_ORDER_STATUS: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'El estado de pedido enviado no es valido',
  },
  INVALID_ORDER_PRIORITY: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'La prioridad de pedido enviada no es valida',
  },
  DELIVERY_NOT_FOUND: {
    status: HTTP_STATUS.NOT_FOUND,
    message: 'La entrega solicitada no existe',
  },
  INVALID_DELIVERY_STATUS: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'El estado de entrega enviado no es valido',
  },

  // --- Modulo de mocking --------------------------------------------------
  INVALID_MOCK_COUNT: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'La cantidad de datos a generar no es valida',
  },
  MOCK_MISSING_USERS: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'No hay usuarios disponibles para asociar a los pedidos',
  },
  MOCK_MISSING_PRODUCTS: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'No hay productos disponibles para armar los pedidos',
  },
  MOCK_MISSING_ORDERS: {
    status: HTTP_STATUS.BAD_REQUEST,
    message: 'No hay pedidos disponibles para asociar a las entregas',
  },
  MOCK_INCOHERENT_DATA: {
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    message: 'Los datos simulados generados no son coherentes entre si',
  },
  MOCK_PERSISTENCE_ERROR: {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: 'Fallo la carga de datos de prueba en la base de datos',
  },
});

/** Codigos disponibles, derivados del propio diccionario. */
const ERROR_CODES = Object.freeze(
  Object.keys(ERROR_DICTIONARY).reduce((acc, code) => ({ ...acc, [code]: code }), {})
);

/**
 * Devuelve la definicion de un codigo. Si el codigo no existe en el diccionario
 * cae en INTERNAL_ERROR: preferible a responder `undefined`.
 */
function getErrorDefinition(code) {
  return ERROR_DICTIONARY[code] ?? ERROR_DICTIONARY.INTERNAL_ERROR;
}

module.exports = { ERROR_DICTIONARY, ERROR_CODES, getErrorDefinition };
