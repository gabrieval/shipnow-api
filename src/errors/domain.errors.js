/**
 * Errores personalizados del dominio de ShipNow.
 *
 * Cada clase representa un caso concreto del negocio. La ventaja frente a
 * lanzar `new Error('...')` es doble:
 *   - El service dice QUE paso ("no hay stock"), no COMO responder ("409").
 *   - El nombre de la clase documenta el caso y se puede distinguir con
 *     `instanceof` en cualquier capa.
 *
 * Todas heredan de AppError, asi que el middleware las trata a todas igual.
 */
const AppError = require('./AppError');
const { ERROR_CODES } = require('./error.dictionary');

// --- Transversales --------------------------------------------------------

/** Datos invalidos enviados por el cliente. `details` lista que esta mal. */
class ValidationError extends AppError {
  constructor(details, message) {
    super(ERROR_CODES.VALIDATION_ERROR, { details, message });
  }
}

/** Identificador con formato incorrecto. */
class InvalidIdError extends AppError {
  constructor(details) {
    super(ERROR_CODES.INVALID_ID, { details });
  }
}

/** El rol de quien pide no alcanza para la accion. */
class ForbiddenRoleError extends AppError {
  constructor(details) {
    super(ERROR_CODES.FORBIDDEN_ROLE, { details });
  }
}

/** Ruta inexistente. La lanza el handler de 404 de la app. */
class RouteNotFoundError extends AppError {
  constructor(method, path) {
    super(ERROR_CODES.ROUTE_NOT_FOUND, { message: `La ruta solicitada no existe: ${method} ${path}` });
  }
}

/** Fallo inesperado de la base de datos, envuelto para no filtrar detalles del driver. */
class DatabaseError extends AppError {
  constructor(cause) {
    super(ERROR_CODES.DATABASE_ERROR, { cause });
  }
}

// --- Productos ------------------------------------------------------------

class ProductNotFoundError extends AppError {
  constructor(id) {
    super(ERROR_CODES.PRODUCT_NOT_FOUND, { details: id ? { id } : undefined });
  }
}

class ProductCodeInUseError extends AppError {
  constructor(code) {
    super(ERROR_CODES.PRODUCT_CODE_IN_USE, { details: { code } });
  }
}

class ProductDiscontinuedError extends AppError {
  constructor(code) {
    super(ERROR_CODES.PRODUCT_DISCONTINUED, { details: { code } });
  }
}

/** Se quiso descontar mas stock del disponible. */
class InsufficientStockError extends AppError {
  constructor({ requested, available } = {}) {
    super(ERROR_CODES.INSUFFICIENT_STOCK, { details: { requested, available } });
  }
}

class InvalidProductStatusError extends AppError {
  constructor(received, allowed) {
    super(ERROR_CODES.INVALID_PRODUCT_STATUS, { details: { received, allowed } });
  }
}

class InvalidProductCategoryError extends AppError {
  constructor(received, allowed) {
    super(ERROR_CODES.INVALID_PRODUCT_CATEGORY, { details: { received, allowed } });
  }
}

// --- Usuarios -------------------------------------------------------------

class UserNotFoundError extends AppError {
  constructor(id) {
    super(ERROR_CODES.USER_NOT_FOUND, { details: id ? { id } : undefined });
  }
}

class EmailInUseError extends AppError {
  constructor(email) {
    super(ERROR_CODES.USER_EMAIL_IN_USE, { details: { email } });
  }
}

/** Login fallido. A proposito no dice si fallo el email o la contrasena. */
class InvalidCredentialsError extends AppError {
  constructor() {
    super(ERROR_CODES.INVALID_CREDENTIALS);
  }
}

class InvalidRoleError extends AppError {
  constructor(received, allowed) {
    super(ERROR_CODES.INVALID_ROLE, { details: { received, allowed } });
  }
}

/** Regla de negocio: el sistema no puede quedarse sin administradores. */
class LastAdminError extends AppError {
  constructor() {
    super(ERROR_CODES.LAST_ADMIN);
  }
}

// --- Pedidos y entregas ---------------------------------------------------

class OrderNotFoundError extends AppError {
  constructor(id) {
    super(ERROR_CODES.ORDER_NOT_FOUND, { details: id ? { id } : undefined });
  }
}

class InvalidOrderStatusError extends AppError {
  constructor(received, allowed) {
    super(ERROR_CODES.INVALID_ORDER_STATUS, { details: { received, allowed } });
  }
}

class InvalidOrderPriorityError extends AppError {
  constructor(received, allowed) {
    super(ERROR_CODES.INVALID_ORDER_PRIORITY, { details: { received, allowed } });
  }
}

class DeliveryNotFoundError extends AppError {
  constructor(id) {
    super(ERROR_CODES.DELIVERY_NOT_FOUND, { details: id ? { id } : undefined });
  }
}

class InvalidDeliveryStatusError extends AppError {
  constructor(received, allowed) {
    super(ERROR_CODES.INVALID_DELIVERY_STATUS, { details: { received, allowed } });
  }
}

// --- Carga de archivos ----------------------------------------------------

/** No llego ningun archivo en la peticion. */
class FileRequiredError extends AppError {
  constructor(field) {
    super(ERROR_CODES.FILE_REQUIRED, {
      message: `No se recibio ningun archivo en el campo "${field}"`,
      details: { field, sugerencia: 'Enviar la peticion como multipart/form-data' },
    });
  }
}

/** El tipo MIME del archivo no esta entre los permitidos. */
class InvalidFileTypeError extends AppError {
  constructor(received, allowed) {
    super(ERROR_CODES.INVALID_FILE_TYPE, { details: { received, allowed } });
  }
}

/** El archivo supera el limite de tamano configurado. */
class FileTooLargeError extends AppError {
  constructor(maxBytes) {
    super(ERROR_CODES.FILE_TOO_LARGE, {
      message: `El archivo supera el tamano maximo permitido de ${Math.round(maxBytes / 1024 / 1024)} MB`,
      details: { maxBytes, maxMb: Math.round(maxBytes / 1024 / 1024) },
    });
  }
}

/** El nombre del campo del formulario no es el que espera el endpoint. */
class UnexpectedFileFieldError extends AppError {
  constructor(received, expected) {
    super(ERROR_CODES.UNEXPECTED_FILE_FIELD, {
      message: `El campo "${received}" no es el esperado por este endpoint`,
      details: { received, expected },
    });
  }
}

/** El tipo de documento no esta entre los admitidos por el dominio. */
class InvalidDocumentTypeError extends AppError {
  constructor(received, allowed) {
    super(ERROR_CODES.INVALID_DOCUMENT_TYPE, { details: { received, allowed } });
  }
}

/** Fallo la escritura o el borrado del archivo en disco. */
class FileStorageError extends AppError {
  constructor({ operation, cause } = {}) {
    super(ERROR_CODES.FILE_STORAGE_ERROR, {
      details: { operation, reason: cause?.message },
      cause,
    });
  }
}

// --- Modulo de mocking ----------------------------------------------------

/**
 * Cantidad de datos a generar invalida: no numerica, negativa, decimal, cero
 * donde no corresponde o por encima del tope permitido.
 */
class InvalidMockCountError extends AppError {
  constructor({ field, received, min, max, reason } = {}) {
    super(ERROR_CODES.INVALID_MOCK_COUNT, {
      message: `El parametro "${field}" no es una cantidad valida: ${reason}`,
      details: { field, received, min, max },
    });
  }
}

/** No hay usuarios con los que relacionar los pedidos pedidos. */
class MockMissingUsersError extends AppError {
  constructor() {
    super(ERROR_CODES.MOCK_MISSING_USERS, {
      details: { sugerencia: 'Envia users > 0 en el body o carga usuarios antes de generar pedidos' },
    });
  }
}

class MockMissingProductsError extends AppError {
  constructor() {
    super(ERROR_CODES.MOCK_MISSING_PRODUCTS, {
      details: { sugerencia: 'Envia products > 0 en el body o carga productos antes de generar pedidos' },
    });
  }
}

class MockMissingOrdersError extends AppError {
  constructor() {
    super(ERROR_CODES.MOCK_MISSING_ORDERS, {
      details: { sugerencia: 'Envia orders > 0 en el body: una entrega no existe sin su pedido' },
    });
  }
}

/** Los datos generados violan una relacion del dominio: se corta antes de insertar. */
class MockIncoherentDataError extends AppError {
  constructor(details) {
    super(ERROR_CODES.MOCK_INCOHERENT_DATA, { details });
  }
}

/** Fallo la escritura en MongoDB durante la carga de datos de prueba. */
class MockPersistenceError extends AppError {
  constructor({ entity, cause } = {}) {
    super(ERROR_CODES.MOCK_PERSISTENCE_ERROR, {
      message: `Fallo la carga de datos de prueba al insertar "${entity}"`,
      details: { entity, reason: cause?.message },
      cause,
    });
  }
}

module.exports = {
  ValidationError,
  FileRequiredError,
  InvalidFileTypeError,
  FileTooLargeError,
  UnexpectedFileFieldError,
  InvalidDocumentTypeError,
  FileStorageError,
  InvalidIdError,
  ForbiddenRoleError,
  RouteNotFoundError,
  DatabaseError,
  ProductNotFoundError,
  ProductCodeInUseError,
  ProductDiscontinuedError,
  InsufficientStockError,
  InvalidProductStatusError,
  InvalidProductCategoryError,
  UserNotFoundError,
  EmailInUseError,
  InvalidCredentialsError,
  InvalidRoleError,
  LastAdminError,
  OrderNotFoundError,
  InvalidOrderStatusError,
  InvalidOrderPriorityError,
  DeliveryNotFoundError,
  InvalidDeliveryStatusError,
  InvalidMockCountError,
  MockMissingUsersError,
  MockMissingProductsError,
  MockMissingOrdersError,
  MockIncoherentDataError,
  MockPersistenceError,
};
