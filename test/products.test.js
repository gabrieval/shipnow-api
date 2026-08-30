/**
 * Tests funcionales del catalogo de Productos.
 */
const { expect } = require('chai');

const { request, asAdmin, asUser } = require('./helpers/request');
const { createProduct, buildProduct, ID_INEXISTENTE } = require('./helpers/fixtures');
const {
  expectSuccess,
  expectError,
  expectPagination,
  expectProductShape,
} = require('./helpers/assertions');
const { PRODUCT_STATUS, PRODUCT_CATEGORIES } = require('../src/constants');

describe('Products - /api/products', () => {
  describe('GET /api/products', () => {
    it('devuelve el listado paginado con el valor del inventario', async () => {
      await createProduct({ price: 100, stock: 2 });
      await createProduct({ price: 50, stock: 4 });

      const payload = expectSuccess(await request.get('/api/products'));

      expect(payload.products).to.be.an('array').with.lengthOf(2);
      expectPagination(payload.pagination);
      expect(payload.summary.inventoryValue).to.equal(400); // 100*2 + 50*4

      payload.products.forEach(expectProductShape);
    });

    it('filtra por categoria', async () => {
      await createProduct({ category: PRODUCT_CATEGORIES.ELECTRONICS });
      await createProduct({ category: PRODUCT_CATEGORIES.HOME });

      const payload = expectSuccess(await request.get(`/api/products?category=${PRODUCT_CATEGORIES.HOME}`));

      expect(payload.products).to.have.lengthOf(1);
      expect(payload.products[0].category).to.equal(PRODUCT_CATEGORIES.HOME);
    });

    it('rechaza una categoria fuera del enum', async () => {
      const res = await request.get('/api/products?category=naves-espaciales');

      const error = expectError(res, 400, 'INVALID_PRODUCT_CATEGORY');
      expect(error.details).to.have.property('received', 'naves-espaciales');
      expect(error.details.allowed).to.have.members(Object.values(PRODUCT_CATEGORIES));
    });
  });

  describe('GET /api/products/available', () => {
    it('deja fuera los productos sin stock', async () => {
      await createProduct({ stock: 5 });
      await createProduct({ stock: 0 });

      const payload = expectSuccess(await request.get('/api/products/available'));

      expect(payload.products).to.have.lengthOf(1);
      expect(payload.products[0].stock).to.be.greaterThan(0);
      expect(payload.products[0].status).to.equal(PRODUCT_STATUS.AVAILABLE);
    });
  });

  describe('POST /api/products', () => {
    it('crea un producto y deriva su estado del stock', async () => {
      const res = await request.post('/api/products').set(asAdmin).send(buildProduct({ stock: 7 }));

      const producto = expectSuccess(res, 201);
      expectProductShape(producto);
      expect(producto.status).to.equal(PRODUCT_STATUS.AVAILABLE);
    });

    it('marca como sin stock un producto creado con stock 0', async () => {
      const producto = expectSuccess(
        await request.post('/api/products').set(asAdmin).send(buildProduct({ stock: 0 })),
        201
      );

      expect(producto.status).to.equal(PRODUCT_STATUS.OUT_OF_STOCK);
    });

    it('normaliza el codigo a mayusculas', async () => {
      const producto = expectSuccess(
        await request.post('/api/products').set(asAdmin).send(buildProduct({ code: 'minusculas-01' })),
        201
      );

      expect(producto.code).to.equal('MINUSCULAS-01');
    });

    it('rechaza el alta con datos incompletos', async () => {
      const res = await request.post('/api/products').set(asAdmin).send({ title: 'Solo el titulo' });

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details.map((d) => d.field)).to.have.members(['description', 'code', 'price']);
    });

    it('rechaza un precio negativo', async () => {
      const res = await request.post('/api/products').set(asAdmin).send(buildProduct({ price: -10 }));

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details[0]).to.have.property('field', 'price');
    });

    it('rechaza un codigo repetido', async () => {
      const existente = await createProduct();

      const res = await request.post('/api/products').set(asAdmin).send(buildProduct({ code: existente.code }));

      expectError(res, 409, 'PRODUCT_CODE_IN_USE');
    });

    it('rechaza el alta a quien no es administrador', async () => {
      const res = await request.post('/api/products').set(asUser).send(buildProduct());

      expectError(res, 403, 'FORBIDDEN_ROLE');
    });
  });

  describe('GET /api/products/:pid', () => {
    it('devuelve el producto solicitado', async () => {
      const producto = await createProduct();

      const payload = expectSuccess(await request.get(`/api/products/${producto._id}`));

      expectProductShape(payload);
      expect(payload._id).to.equal(producto._id);
    });

    it('devuelve 404 ante un producto inexistente', async () => {
      const res = await request.get(`/api/products/${ID_INEXISTENTE}`);

      expectError(res, 404, 'PRODUCT_NOT_FOUND');
    });
  });

  describe('PATCH /api/products/:pid/stock', () => {
    it('descuenta stock y recalcula el estado al llegar a cero', async () => {
      const producto = await createProduct({ stock: 3 });

      const payload = expectSuccess(
        await request.patch(`/api/products/${producto._id}/stock`).send({ quantity: 3 })
      );

      expect(payload.stock).to.equal(0);
      expect(payload.status).to.equal(PRODUCT_STATUS.OUT_OF_STOCK);
    });

    it('rechaza descontar mas stock del disponible', async () => {
      const producto = await createProduct({ stock: 2 });

      const res = await request.patch(`/api/products/${producto._id}/stock`).send({ quantity: 10 });

      const error = expectError(res, 409, 'INSUFFICIENT_STOCK');
      expect(error.details).to.include({ requested: 10, available: 2 });
    });

    it('rechaza una cantidad invalida', async () => {
      const producto = await createProduct();

      const res = await request.patch(`/api/products/${producto._id}/stock`).send({ quantity: 0 });

      expectError(res, 400, 'VALIDATION_ERROR');
    });
  });

  describe('PUT y DELETE /api/products/:pid', () => {
    it('actualiza el producto y recalcula el estado', async () => {
      const producto = await createProduct({ stock: 0 });

      const payload = expectSuccess(
        await request.put(`/api/products/${producto._id}`).set(asAdmin).send({ stock: 5 })
      );

      expect(payload.stock).to.equal(5);
      expect(payload.status).to.equal(PRODUCT_STATUS.AVAILABLE);
    });

    it('da de baja el producto y deja de listarlo', async () => {
      const producto = await createProduct();

      expectSuccess(await request.delete(`/api/products/${producto._id}`).set(asAdmin));

      expectError(await request.get(`/api/products/${producto._id}`), 404, 'PRODUCT_NOT_FOUND');
    });

    it('rechaza la baja a quien no es administrador', async () => {
      const producto = await createProduct();

      expectError(await request.delete(`/api/products/${producto._id}`).set(asUser), 403, 'FORBIDDEN_ROLE');
    });
  });
});
