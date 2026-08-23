/**
 * Tests funcionales de carga de archivos.
 *
 * Los archivos se envian como `multipart/form-data` con `.attach()` de
 * Supertest, desde buffers armados en memoria: no hay archivos de prueba
 * versionados en el repositorio.
 *
 * Todo lo que se escribe en disco durante los tests va a `uploads-test/`, que
 * se borra entera al terminar (ver `test/helpers/root-hooks.js`).
 */
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const { request, asAdmin } = require('./helpers/request');
const { createUser, createOrder, generateMockData, ID_INEXISTENTE } = require('./helpers/fixtures');
const { expectSuccess, expectError } = require('./helpers/assertions');
const { UPLOAD_ROOT } = require('../src/config/multer.config');
const { DOCUMENT_TYPES, UPLOAD_RULES } = require('../src/constants');

/** PNG minimo valido, en memoria. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/** PDF minimo valido, en memoria. */
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

/** Comprueba que el archivo exista realmente en disco. */
function existeEnDisco(rutaRelativa) {
  return fs.existsSync(path.join(UPLOAD_ROOT, rutaRelativa));
}

describe('Uploads - documentos de usuario', () => {
  describe('POST /api/users/:uid/documents', () => {
    it('carga un documento y devuelve el usuario con sus metadatos', async () => {
      const usuario = await createUser();

      const res = await request
        .post(`/api/users/${usuario._id}/documents`)
        .field('documentType', DOCUMENT_TYPES.ID_CARD)
        .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PNG, { filename: 'dni.png', contentType: 'image/png' });

      const payload = expectSuccess(res, 201);

      expect(payload).to.have.property('user');
      expect(payload).to.have.property('document');

      const doc = payload.document;
      expect(doc).to.include.all.keys(
        'originalName',
        'fileName',
        'path',
        'mimeType',
        'size',
        'documentType',
        'uploadedAt'
      );
      expect(doc.originalName).to.equal('dni.png');
      expect(doc.mimeType).to.equal('image/png');
      expect(doc.documentType).to.equal(DOCUMENT_TYPES.ID_CARD);
      expect(doc.size).to.be.a('number').and.greaterThan(0);

      // El nombre en disco no es el que mando el cliente.
      expect(doc.fileName).to.not.equal('dni.png');
      expect(doc.fileName).to.match(/^\d+-[a-f0-9]+\.png$/);

      // El documento quedo asociado al usuario.
      expect(payload.user.documents).to.be.an('array').with.lengthOf(1);
      expect(payload.user.documents[0].fileName).to.equal(doc.fileName);
    });

    it('guarda el archivo en la subcarpeta de su tipo de documento', async () => {
      const usuario = await createUser();

      const payload = expectSuccess(
        await request
          .post(`/api/users/${usuario._id}/documents`)
          .field('documentType', DOCUMENT_TYPES.DRIVER_LICENSE)
          .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PNG, { filename: 'licencia.png', contentType: 'image/png' }),
        201
      );

      expect(payload.document.path).to.contain(`documents/${DOCUMENT_TYPES.DRIVER_LICENSE}/`);
      expect(existeEnDisco(payload.document.path), 'el archivo tiene que existir en disco').to.equal(true);
    });

    it('guarda una ruta relativa, sin exponer la estructura del servidor', async () => {
      const usuario = await createUser();

      const payload = expectSuccess(
        await request
          .post(`/api/users/${usuario._id}/documents`)
          .field('documentType', DOCUMENT_TYPES.TAX_ID)
          .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PDF, { filename: 'cuit.pdf', contentType: 'application/pdf' }),
        201
      );

      expect(payload.document.path).to.not.contain(':');
      expect(path.isAbsolute(payload.document.path)).to.equal(false);
    });

    it('acepta un PDF', async () => {
      const usuario = await createUser();

      const payload = expectSuccess(
        await request
          .post(`/api/users/${usuario._id}/documents`)
          .field('documentType', DOCUMENT_TYPES.INSURANCE)
          .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PDF, { filename: 'seguro.pdf', contentType: 'application/pdf' }),
        201
      );

      expect(payload.document.mimeType).to.equal('application/pdf');
      expect(payload.document.fileName).to.match(/\.pdf$/);
    });

    it('permite acumular varios documentos en un mismo usuario', async () => {
      const usuario = await createUser();

      await request
        .post(`/api/users/${usuario._id}/documents`)
        .field('documentType', DOCUMENT_TYPES.ID_CARD)
        .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PNG, { filename: 'dni.png', contentType: 'image/png' });

      const payload = expectSuccess(
        await request
          .post(`/api/users/${usuario._id}/documents`)
          .field('documentType', DOCUMENT_TYPES.DRIVER_LICENSE)
          .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PNG, { filename: 'licencia.png', contentType: 'image/png' }),
        201
      );

      expect(payload.user.documents).to.have.lengthOf(2);
    });

    it('rechaza la carga cuando no se envia ningun archivo', async () => {
      const usuario = await createUser();

      const res = await request
        .post(`/api/users/${usuario._id}/documents`)
        .field('documentType', DOCUMENT_TYPES.ID_CARD);

      const error = expectError(res, 400, 'FILE_REQUIRED');
      expect(error.details).to.have.property('field', UPLOAD_RULES.FIELDS.USER_DOCUMENT);
    });

    it('rechaza un tipo de documento invalido', async () => {
      const usuario = await createUser();

      const res = await request
        .post(`/api/users/${usuario._id}/documents`)
        .field('documentType', 'pasaporte-galactico')
        .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PNG, { filename: 'doc.png', contentType: 'image/png' });

      const error = expectError(res, 400, 'INVALID_DOCUMENT_TYPE');
      expect(error.details).to.have.property('received', 'pasaporte-galactico');
      expect(error.details.allowed).to.have.members(Object.values(DOCUMENT_TYPES));
    });

    it('rechaza la carga si falta el tipo de documento', async () => {
      const usuario = await createUser();

      const res = await request
        .post(`/api/users/${usuario._id}/documents`)
        .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PNG, { filename: 'doc.png', contentType: 'image/png' });

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details[0]).to.have.property('field', 'documentType');
    });

    it('rechaza un tipo de archivo no permitido', async () => {
      const usuario = await createUser();

      const res = await request
        .post(`/api/users/${usuario._id}/documents`)
        .field('documentType', DOCUMENT_TYPES.ID_CARD)
        .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, Buffer.from('#!/bin/sh\necho hola\n'), {
          filename: 'script.sh',
          contentType: 'application/x-sh',
        });

      const error = expectError(res, 415, 'INVALID_FILE_TYPE');
      expect(error.details).to.have.property('received', 'application/x-sh');
      expect(error.details.allowed).to.have.members(Object.keys(UPLOAD_RULES.ALLOWED_MIME_TYPES));
    });

    it('rechaza un archivo que supera el tamano maximo', async () => {
      const usuario = await createUser();
      const demasiadoGrande = Buffer.alloc(UPLOAD_RULES.MAX_FILE_SIZE + 1024, 0);

      const res = await request
        .post(`/api/users/${usuario._id}/documents`)
        .field('documentType', DOCUMENT_TYPES.ID_CARD)
        .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, demasiadoGrande, {
          filename: 'enorme.png',
          contentType: 'image/png',
        });

      const error = expectError(res, 413, 'FILE_TOO_LARGE');
      expect(error.details).to.have.property('maxBytes', UPLOAD_RULES.MAX_FILE_SIZE);
    });

    it('rechaza un campo de formulario distinto al esperado', async () => {
      const usuario = await createUser();

      const res = await request
        .post(`/api/users/${usuario._id}/documents`)
        .field('documentType', DOCUMENT_TYPES.ID_CARD)
        .attach('archivo', PNG, { filename: 'doc.png', contentType: 'image/png' });

      const error = expectError(res, 400, 'UNEXPECTED_FILE_FIELD');
      expect(error.details).to.have.property('expected', UPLOAD_RULES.FIELDS.USER_DOCUMENT);
    });

    it('rechaza la carga si el usuario no existe', async () => {
      const res = await request
        .post(`/api/users/${ID_INEXISTENTE}/documents`)
        .field('documentType', DOCUMENT_TYPES.ID_CARD)
        .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PNG, { filename: 'dni.png', contentType: 'image/png' });

      expectError(res, 404, 'USER_NOT_FOUND');
    });

    it('no deja el archivo en disco si la carga se rechaza', async () => {
      const carpeta = path.join(UPLOAD_ROOT, UPLOAD_RULES.FOLDERS.DOCUMENTS, DOCUMENT_TYPES.ID_CARD);
      const antes = fs.existsSync(carpeta) ? fs.readdirSync(carpeta).length : 0;

      await request
        .post(`/api/users/${ID_INEXISTENTE}/documents`)
        .field('documentType', DOCUMENT_TYPES.ID_CARD)
        .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PNG, { filename: 'huerfano.png', contentType: 'image/png' });

      const despues = fs.existsSync(carpeta) ? fs.readdirSync(carpeta).length : 0;
      expect(despues, 'el archivo huerfano tiene que borrarse').to.equal(antes);
    });
  });
});

describe('Uploads - comprobantes', () => {
  describe('POST /api/orders/:oid/receipt', () => {
    it('adjunta un comprobante de pago al pedido', async () => {
      const { order } = await createOrder();

      const res = await request
        .post(`/api/orders/${order._id}/receipt`)
        .attach(UPLOAD_RULES.FIELDS.RECEIPT, PDF, { filename: 'pago.pdf', contentType: 'application/pdf' });

      const payload = expectSuccess(res, 201);

      expect(payload).to.have.property('order');
      expect(payload).to.have.property('receipt');
      expect(payload.receipt.originalName).to.equal('pago.pdf');
      expect(payload.receipt.path).to.contain('receipts/orders/');
      expect(payload.order.receipts).to.be.an('array').with.lengthOf(1);
      expect(existeEnDisco(payload.receipt.path)).to.equal(true);
    });

    it('rechaza el comprobante si falta el archivo', async () => {
      const { order } = await createOrder();

      const res = await request.post(`/api/orders/${order._id}/receipt`);

      const error = expectError(res, 400, 'FILE_REQUIRED');
      expect(error.details).to.have.property('field', UPLOAD_RULES.FIELDS.RECEIPT);
    });

    it('rechaza el comprobante si el pedido no existe', async () => {
      const res = await request
        .post(`/api/orders/${ID_INEXISTENTE}/receipt`)
        .attach(UPLOAD_RULES.FIELDS.RECEIPT, PDF, { filename: 'pago.pdf', contentType: 'application/pdf' });

      expectError(res, 404, 'ORDER_NOT_FOUND');
    });
  });

  describe('POST /api/deliveries/:did/receipt', () => {
    /** Devuelve una entrega del lote generado por el modulo de mocks. */
    async function unaEntrega() {
      await generateMockData({ users: 1, couriers: 1, products: 2, orders: 1, deliveries: 1 });
      const payload = expectSuccess(await request.get('/api/deliveries'));
      return payload.deliveries[0];
    }

    it('adjunta un comprobante de entrega', async () => {
      const entrega = await unaEntrega();

      const res = await request
        .post(`/api/deliveries/${entrega._id}/receipt`)
        .attach(UPLOAD_RULES.FIELDS.RECEIPT, PNG, { filename: 'firma.png', contentType: 'image/png' });

      const payload = expectSuccess(res, 201);

      expect(payload.receipt.originalName).to.equal('firma.png');
      expect(payload.receipt.path).to.contain('receipts/deliveries/');
      expect(payload.delivery.receipts).to.have.lengthOf(1);
      expect(existeEnDisco(payload.receipt.path)).to.equal(true);
    });

    it('rechaza el comprobante si falta el archivo', async () => {
      const entrega = await unaEntrega();

      const res = await request.post(`/api/deliveries/${entrega._id}/receipt`);

      expectError(res, 400, 'FILE_REQUIRED');
    });

    it('rechaza el comprobante si la entrega no existe', async () => {
      const res = await request
        .post(`/api/deliveries/${ID_INEXISTENTE}/receipt`)
        .attach(UPLOAD_RULES.FIELDS.RECEIPT, PNG, { filename: 'firma.png', contentType: 'image/png' });

      expectError(res, 404, 'DELIVERY_NOT_FOUND');
    });

    it('rechaza un tipo de archivo no permitido', async () => {
      const entrega = await unaEntrega();

      const res = await request
        .post(`/api/deliveries/${entrega._id}/receipt`)
        .attach(UPLOAD_RULES.FIELDS.RECEIPT, Buffer.from('texto plano'), {
          filename: 'nota.txt',
          contentType: 'text/plain',
        });

      expectError(res, 415, 'INVALID_FILE_TYPE');
    });
  });
});

describe('Uploads - la base guarda metadatos, no archivos', () => {
  it('el documento persistido no contiene el binario', async () => {
    const usuario = await createUser();

    await request
      .post(`/api/users/${usuario._id}/documents`)
      .field('documentType', DOCUMENT_TYPES.ID_CARD)
      .attach(UPLOAD_RULES.FIELDS.USER_DOCUMENT, PNG, { filename: 'dni.png', contentType: 'image/png' });

    const guardado = expectSuccess(await request.get(`/api/users/${usuario._id}`).set(asAdmin));
    const doc = guardado.documents[0];

    expect(doc).to.not.have.property('buffer');
    expect(doc).to.not.have.property('data');
    expect(doc).to.not.have.property('content');
    // Solo referencias y metadatos.
    expect(Object.keys(doc)).to.have.members([
      '_id',
      'originalName',
      'fileName',
      'path',
      'mimeType',
      'size',
      'documentType',
      'uploadedAt',
    ]);
  });
});
