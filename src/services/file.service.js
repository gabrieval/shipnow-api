/**
 * FileService - reglas comunes a toda carga de archivos.
 *
 * Multer ya escribio el archivo en disco cuando este service entra en juego.
 * Lo que se decide aca:
 *   - Que un archivo haya llegado de verdad.
 *   - Que forma tienen los metadatos que se guardan en la base.
 *   - Que hacer con el archivo si la asociacion falla: borrarlo, para no dejar
 *     archivos huerfanos ocupando disco sin ninguna entidad que los referencie.
 *
 * Los services de usuarios, pedidos y entregas se apoyan en este.
 */
const { removeFile, toRelativePath } = require('../config/multer.config');
const { logger } = require('../config');
const { FileRequiredError } = require('../errors');

class FileService {
  /**
   * Comprueba que Multer haya dejado un archivo. Si el cliente no envio nada,
   * `req.file` viene `undefined` y hay que cortar antes de tocar la base.
   * @param {object|undefined} file el `req.file` de Multer
   * @param {string} field nombre del campo esperado, para el mensaje de error
   */
  assertFileExists(file, field) {
    if (!file) throw new FileRequiredError(field);
    return file;
  }

  /**
   * Arma los metadatos que se guardan en MongoDB.
   * El contenido del archivo NO entra aca: solo la referencia a donde quedo.
   */
  buildMetadata(file, { documentType } = {}) {
    return {
      originalName: file.originalname,
      fileName: file.filename,
      // Ruta relativa a la carpeta de uploads: no se filtra la estructura del servidor.
      path: toRelativePath(file.path),
      mimeType: file.mimetype,
      size: file.size,
      ...(documentType ? { documentType } : {}),
      uploadedAt: new Date(),
    };
  }

  /**
   * Ejecuta la asociacion del archivo con su entidad y, si algo falla, borra el
   * archivo ya escrito antes de propagar el error.
   * @param {object} file el archivo de Multer
   * @param {Function} operation funcion asincronica que asocia y devuelve la entidad
   */
  async withRollback(file, operation) {
    try {
      return await operation();
    } catch (error) {
      if (file?.path) await removeFile(file.path);
      logger.warning('Se descarto un archivo que no se pudo asociar', {
        archivo: file?.filename,
        motivo: error.message,
      });
      throw error;
    }
  }

  /** Deja registro de una carga exitosa. */
  logUpload({ ownerType, ownerId, metadata }) {
    logger.info('Archivo cargado y asociado', {
      entidad: ownerType,
      id: String(ownerId),
      archivo: metadata.fileName,
      tipo: metadata.mimeType,
      tamanoKb: Math.round(metadata.size / 1024),
      ...(metadata.documentType ? { tipoDocumento: metadata.documentType } : {}),
    });
  }
}

module.exports = new FileService();
module.exports.FileService = FileService;
