/**
 * Configuracion centralizada de Multer.
 *
 * Unico lugar del proyecto donde se decide:
 *   - Donde se guardan los archivos.
 *   - Como se nombran.
 *   - Que tipos se aceptan.
 *   - Cual es el tamano maximo.
 *   - Como se traducen los errores de carga al sistema de errores del proyecto.
 *
 * Los routers solo piden un middleware ya armado (`uploadUserDocument`,
 * `uploadReceipt`): no configuran nada.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const config = require('./env.config');
const { logger } = require('./logger.config');
const { UPLOAD_RULES } = require('../constants');
const { InvalidFileTypeError, FileTooLargeError, UnexpectedFileFieldError, FileStorageError } = require('../errors');

/**
 * Raiz de las cargas. En testing se usa una carpeta aparte para que la suite
 * pueda borrarla entera sin riesgo de tocar archivos reales.
 */
const UPLOAD_ROOT = path.resolve(__dirname, '../../', config.isTest ? 'uploads-test' : 'uploads');

/**
 * Crea la carpeta destino si no existe. Multer no la crea por su cuenta.
 *
 * Asincronica a proposito: `mkdirSync` bloquearia el Event Loop en cada carga,
 * y el destino de Multer admite callback justamente para esto.
 */
async function ensureFolder(folder) {
  const destino = path.join(UPLOAD_ROOT, folder);
  await fs.promises.mkdir(destino, { recursive: true });
  return destino;
}

/**
 * Nombre con el que se guarda el archivo en disco.
 *
 * No se conserva el nombre original: dos usuarios podrian subir "dni.jpg" y
 * pisarse, y un nombre que viene del cliente no es de fiar. Se arma uno propio
 * y el original queda en los metadatos.
 */
function buildFilename(file) {
  const extension = UPLOAD_RULES.ALLOWED_MIME_TYPES[file.mimetype] ?? path.extname(file.originalname);
  const marca = Date.now();
  const aleatorio = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${marca}-${aleatorio}${extension}`;
}

/**
 * Filtro de tipos. Multer solo admite que le pasemos un error, asi que se le
 * entrega directamente un error del dominio: el middleware global despues lo
 * responde con el mismo formato que cualquier otro.
 */
function fileFilter(req, file, done) {
  const permitidos = Object.keys(UPLOAD_RULES.ALLOWED_MIME_TYPES);

  if (!permitidos.includes(file.mimetype)) {
    logger.warning('Intento de subir un tipo de archivo no permitido', {
      tipo: file.mimetype,
      archivo: file.originalname,
      ruta: req.originalUrl,
    });
    return done(new InvalidFileTypeError(file.mimetype, permitidos));
  }

  return done(null, true);
}

/**
 * Crea un middleware de carga para un unico archivo.
 * @param {{folder: string|Function, field: string}} params
 *   `folder` puede ser una funcion `(req) => string` para elegir la subcarpeta
 *   en base a la peticion (por ejemplo, el tipo de documento).
 */
function buildUploader({ folder, field }) {
  const storage = multer.diskStorage({
    destination(req, file, done) {
      const subcarpeta = typeof folder === 'function' ? folder(req) : folder;
      ensureFolder(subcarpeta)
        .then((destino) => done(null, destino))
        .catch((error) => done(new FileStorageError({ operation: 'crear la carpeta destino', cause: error })));
    },
    filename(req, file, done) {
      done(null, buildFilename(file));
    },
  });

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: UPLOAD_RULES.MAX_FILE_SIZE,
      files: UPLOAD_RULES.MAX_FILES,
    },
  }).single(field);

  /**
   * Se envuelve la llamada de Multer para traducir SUS errores a errores del
   * dominio antes de que lleguen al middleware global. Sin esto, un archivo
   * demasiado grande respondería con un error de Multer, distinto al del resto
   * de la API.
   */
  return function uploadMiddleware(req, res, next) {
    upload(req, res, (error) => {
      if (!error) return next();
      return next(translateMulterError(error, field));
    });
  };
}

/** Traduce un `MulterError` al error de dominio equivalente. */
function translateMulterError(error, expectedField) {
  if (!(error instanceof multer.MulterError)) return error;

  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return new FileTooLargeError(UPLOAD_RULES.MAX_FILE_SIZE);
    case 'LIMIT_UNEXPECTED_FILE':
    case 'LIMIT_FILE_COUNT':
      return new UnexpectedFileFieldError(error.field, expectedField);
    default:
      return new FileStorageError({ operation: `carga (${error.code})`, cause: error });
  }
}

/** Borra un archivo ya escrito en disco. Se usa cuando la carga no se puede asociar. */
async function removeFile(absolutePath) {
  try {
    await fs.promises.unlink(absolutePath);
    logger.debug('Archivo huerfano eliminado', { archivo: path.basename(absolutePath) });
  } catch (error) {
    // Que no se pueda borrar no invalida la respuesta al cliente: se registra y sigue.
    logger.warning('No se pudo eliminar un archivo huerfano', { motivo: error.message });
  }
}

/** Ruta relativa a la raiz de uploads, que es la que se guarda en la base. */
function toRelativePath(absolutePath) {
  return path.relative(UPLOAD_ROOT, absolutePath).split(path.sep).join('/');
}

module.exports = {
  UPLOAD_ROOT,
  buildUploader,
  removeFile,
  toRelativePath,
  ensureFolder,
};
