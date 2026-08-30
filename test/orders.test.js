/**
 * Tests funcionales de Pedidos.
 *
 * Es el modulo que mas cruza entidades: cada pedido necesita un usuario y
 * productos con stock. Todo eso lo crean los fixtures dentro del propio test.
 */
const { expect } = require('chai');

const { request, asAdmin, asUser } = require('./helpers/request');
const {
  createUser,
  createProduct,
  createOrder,
  buildAddress,
  ID_INEXISTENTE,
} = require('./helpers/fixtures');
const {
  expectSuccess,
  expectError,
  expectPagination,
  expectOrderShape,
} = require('./helpers/assertions');
const { ORDER_STATUS, ORDER_PRIORITY } = require('../src/constants');

describe('Orders - /api/orders', () => {
  describe('POST /api/orders', () => {
    it('crea un pedido con datos validos', async () => {
      const usuario = await createUser();
      const producto = await createProduct({ price: 250, stock: 10 });

      const res = await request.post('/api/orders').send({
        user: usuario._id,
        items: [{ product: producto._id, quantity: 2 }],
        shippingAddress: buildAddress(),
      });

      const pedido = expectSuccess(res, 201);
      expectOrderShape(pedido);

      expect(pedido.status).to.equal(ORDER_STATUS.PENDING);
      expect(pedido.priority).to.equal(ORDER_PRIORITY.NORMAL);
      expect(pedido.items).to.have.lengthOf(1);
      expect(pedido.items[0]).to.include({ quantity: 2, unitPrice: 250, subtotal: 500 });
      expect(pedido.total).to.equal(500);
      expect(pedido.code).to.be.a('string');
    });

    it('calcula el total sin confiar en lo que manda el cliente', async () => {
      const usuario = await createUser();
      const producto = await createProduct({ price: 100, stock: 10 });

      const pedido = expectSuccess(
        await request.post('/api/orders').send({
          user: usuario._id,
          items: [{ product: producto._id, quantity: 3 }],
          shippingAddress: buildAddress(),
          total: 1, // intento de manipular el total
        }),
        201
      );

      expect(pedido.total).to.equal(300);
    });

    it('descuenta el stock de los productos comprados', async () => {
      const usuario = await createUser();
      const producto = await createProduct({ stock: 10 });

      await request.post('/api/orders').send({
        user: usuario._id,
        items: [{ product: producto._id, quantity: 4 }],
        shippingAddress: buildAddress(),
      });

      const actualizado = expectSuccess(await request.get(`/api/products/${producto._id}`));
      expect(actualizado.stock).to.equal(6);
    });

    it('admite varios items y suma los subtotales', async () => {
      const usuario = await createUser();
      const uno = await createProduct({ price: 100, stock: 5 });
      const otro = await createProduct({ price: 50, stock: 5 });

      const pedido = expectSuccess(
        await request.post('/api/orders').send({
          user: usuario._id,
          items: [
            { product: uno._id, quantity: 2 },
            { product: otro._id, quantity: 3 },
          ],
          shippingAddress: buildAddress(),
        }),
        201
      );

      expect(pedido.items).to.have.lengthOf(2);
      expect(pedido.total).to.equal(350);
    });

    it('rechaza el alta con datos incompletos', async () => {
      const usuario = await createUser();

      const res = await request.post('/api/orders').send({ user: usuario._id });

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details.map((d) => d.field)).to.have.members(['items', 'shippingAddress']);
    });

    it('rechaza un pedido sin items', async () => {
      const usuario = await createUser();

      const res = await request.post('/api/orders').send({
        user: usuario._id,
        items: [],
        shippingAddress: buildAddress(),
      });

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details[0]).to.have.property('field', 'items');
    });

    it('rechaza una cantidad que no es un entero mayor a 0', async () => {
      const usuario = await createUser();
      const producto = await createProduct();

      const res = await request.post('/api/orders').send({
        user: usuario._id,
        items: [{ product: producto._id, quantity: 0 }],
        shippingAddress: buildAddress(),
      });

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details[0].field).to.equal('items[0].quantity');
    });

    it('rechaza una direccion de envio incompleta', async () => {
      const usuario = await createUser();
      const producto = await createProduct();

      const res = await request.post('/api/orders').send({
        user: usuario._id,
        items: [{ product: producto._id, quantity: 1 }],
        shippingAddress: { street: 'Sin ciudad ni pais' },
      });

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details[0].field).to.equal('shippingAddress.city');
    });

    it('rechaza una prioridad invalida', async () => {
      const usuario = await createUser();
      const producto = await createProduct();

      const res = await request.post('/api/orders').send({
        user: usuario._id,
        items: [{ product: producto._id, quantity: 1 }],
        shippingAddress: buildAddress(),
        priority: 'urgentisimo',
      });

      const error = expectError(res, 400, 'INVALID_ORDER_PRIORITY');
      expect(error.details.allowed).to.have.members(Object.values(ORDER_PRIORITY));
    });

    it('rechaza un usuario inexistente', async () => {
      const producto = await createProduct();

      const res = await request.post('/api/orders').send({
        user: ID_INEXISTENTE,
        items: [{ product: producto._id, quantity: 1 }],
        shippingAddress: buildAddress(),
      });

      expectError(res, 404, 'USER_NOT_FOUND');
    });

    it('rechaza un producto inexistente', async () => {
      const usuario = await createUser();

      const res = await request.post('/api/orders').send({
        user: usuario._id,
        items: [{ product: ID_INEXISTENTE, quantity: 1 }],
        shippingAddress: buildAddress(),
      });

      expectError(res, 404, 'PRODUCT_NOT_FOUND');
    });

    it('rechaza el pedido si no hay stock suficiente', async () => {
      const usuario = await createUser();
      const producto = await createProduct({ stock: 2 });

      const res = await request.post('/api/orders').send({
        user: usuario._id,
        items: [{ product: producto._id, quantity: 5 }],
        shippingAddress: buildAddress(),
      });

      const error = expectError(res, 409, 'INSUFFICIENT_STOCK');
      expect(error.details).to.include({ requested: 5, available: 2 });
    });

    it('no descuenta stock de ningun producto si el pedido falla', async () => {
      const usuario = await createUser();
      const conStock = await createProduct({ stock: 10 });
      const sinStock = await createProduct({ stock: 1 });

      const res = await request.post('/api/orders').send({
        user: usuario._id,
        items: [
          { product: conStock._id, quantity: 2 },
          { product: sinStock._id, quantity: 9 },
        ],
        shippingAddress: buildAddress(),
      });

      expectError(res, 409, 'INSUFFICIENT_STOCK');

      // El primer producto no tiene que haber quedado descontado.
      const revisado = expectSuccess(await request.get(`/api/products/${conStock._id}`));
      expect(revisado.stock).to.equal(10);
    });
  });

  describe('GET /api/orders', () => {
    it('devuelve el listado paginado con el total facturado', async () => {
      await createOrder();
      await createOrder();

      const payload = expectSuccess(await request.get('/api/orders'));

      expect(payload.orders).to.be.an('array').with.lengthOf(2);
      expectPagination(payload.pagination);
      expect(payload.summary).to.have.property('billedAmount').that.is.a('number');

      const suma = payload.orders.reduce((acc, o) => acc + o.total, 0);
      expect(payload.summary.billedAmount).to.be.closeTo(suma, 0.01);

      payload.orders.forEach(expectOrderShape);
    });

    it('resuelve el usuario dueno de cada pedido', async () => {
      const { user } = await createOrder();

      const payload = expectSuccess(await request.get('/api/orders'));

      expect(payload.orders[0].user).to.be.an('object');
      expect(payload.orders[0].user).to.have.property('email', user.email);
    });

    it('filtra por estado', async () => {
      await createOrder();

      const conEstado = expectSuccess(await request.get(`/api/orders?status=${ORDER_STATUS.PENDING}`));
      expect(conEstado.orders).to.have.lengthOf(1);

      const sinResultados = expectSuccess(await request.get(`/api/orders?status=${ORDER_STATUS.DELIVERED}`));
      expect(sinResultados.orders).to.have.lengthOf(0);
    });

    it('rechaza un estado invalido', async () => {
      const res = await request.get('/api/orders?status=entregadisimo');

      const error = expectError(res, 400, 'INVALID_ORDER_STATUS');
      expect(error.details).to.have.property('received', 'entregadisimo');
      expect(error.details.allowed).to.have.members(Object.values(ORDER_STATUS));
    });

    it('rechaza una prioridad invalida', async () => {
      const res = await request.get('/api/orders?priority=altisima');

      expectError(res, 400, 'INVALID_ORDER_PRIORITY');
    });
  });

  describe('GET /api/orders/:oid', () => {
    it('devuelve el pedido solicitado por id', async () => {
      const { order } = await createOrder();

      const payload = expectSuccess(await request.get(`/api/orders/${order._id}`));

      expectOrderShape(payload);
      expect(payload._id).to.equal(order._id);
      expect(payload.code).to.equal(order.code);
    });

    it('devuelve 404 ante un pedido inexistente', async () => {
      const res = await request.get(`/api/orders/${ID_INEXISTENTE}`);

      expectError(res, 404, 'ORDER_NOT_FOUND');
    });

    it('devuelve 404 ante un id con formato invalido', async () => {
      const res = await request.get('/api/orders/no-es-un-id');

      expectError(res, 404, 'ORDER_NOT_FOUND');
    });
  });

  describe('PATCH /api/orders/:oid/status', () => {
    it('avanza el estado por una transicion permitida', async () => {
      const { order } = await createOrder();

      const res = await request
        .patch(`/api/orders/${order._id}/status`)
        .set(asAdmin)
        .send({ status: ORDER_STATUS.CONFIRMED });

      const payload = expectSuccess(res, 200);
      expect(payload.status).to.equal(ORDER_STATUS.CONFIRMED);
    });

    it('rechaza una transicion no permitida e informa las validas', async () => {
      const { order } = await createOrder();

      const res = await request
        .patch(`/api/orders/${order._id}/status`)
        .set(asAdmin)
        .send({ status: ORDER_STATUS.DELIVERED });

      const error = expectError(res, 400, 'INVALID_ORDER_STATUS');
      expect(error.details.allowed).to.have.members([ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED]);
    });

    it('rechaza cambios sobre un pedido cancelado, que es terminal', async () => {
      const { order } = await createOrder();

      await request.patch(`/api/orders/${order._id}/status`).set(asAdmin).send({ status: ORDER_STATUS.CANCELLED });

      const res = await request
        .patch(`/api/orders/${order._id}/status`)
        .set(asAdmin)
        .send({ status: ORDER_STATUS.CONFIRMED });

      expectError(res, 400, 'INVALID_ORDER_STATUS');
    });

    it('rechaza un estado que no existe', async () => {
      const { order } = await createOrder();

      const res = await request.patch(`/api/orders/${order._id}/status`).set(asAdmin).send({ status: 'inventado' });

      expectError(res, 400, 'INVALID_ORDER_STATUS');
    });

    it('rechaza el cambio si falta el campo status', async () => {
      const { order } = await createOrder();

      const res = await request.patch(`/api/orders/${order._id}/status`).set(asAdmin).send({});

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details[0]).to.have.property('field', 'status');
    });

    it('rechaza el cambio a quien no es administrador', async () => {
      const { order } = await createOrder();

      const res = await request
        .patch(`/api/orders/${order._id}/status`)
        .set(asUser)
        .send({ status: ORDER_STATUS.CONFIRMED });

      expectError(res, 403, 'FORBIDDEN_ROLE');
    });

    it('devuelve 404 ante un pedido inexistente', async () => {
      const res = await request
        .patch(`/api/orders/${ID_INEXISTENTE}/status`)
        .set(asAdmin)
        .send({ status: ORDER_STATUS.CONFIRMED });

      expectError(res, 404, 'ORDER_NOT_FOUND');
    });
  });
});
