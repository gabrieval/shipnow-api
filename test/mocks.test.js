/**
 * Tests funcionales del modulo de Mocks.
 *
 * Dos comportamientos distintos que hay que verificar por separado:
 *  - Los GET generan datos pero NO tocan la base.
 *  - El POST inserta, y solo para administradores.
 */
const { expect } = require('chai');

const { request, asAdmin, asUser } = require('./helpers/request');
const { createUser, generateMockData } = require('./helpers/fixtures');
const {
  expectSuccess,
  expectError,
  expectUserShape,
  expectProductShape,
  expectOrderShape,
  expectDeliveryShape,
} = require('./helpers/assertions');
const {
  USER_ROLES,
  ORDER_STATUS,
  ORDER_PRIORITY,
  DELIVERY_STATUS,
  MOCK_LIMITS,
} = require('../src/constants');

describe('Mocks - /api/mocks', () => {
  describe('Generacion sin persistir', () => {
    it('genera usuarios con roles validos y sin exponer la contrasena', async () => {
      const payload = expectSuccess(await request.get('/api/mocks/users?count=5'));

      expect(payload.count).to.equal(5);
      expect(payload.users).to.be.an('array').with.lengthOf(5);

      payload.users.forEach((usuario) => {
        expectUserShape(usuario);
        expect(usuario).to.not.have.property('password');
      });
    });

    it('genera repartidores siempre con rol courier', async () => {
      const payload = expectSuccess(await request.get('/api/mocks/couriers?count=4'));

      expect(payload.couriers).to.have.lengthOf(4);
      payload.couriers.forEach((c) => expect(c.role).to.equal(USER_ROLES.COURIER));
    });

    it('genera productos con estado coherente con su stock', async () => {
      const payload = expectSuccess(await request.get('/api/mocks/products?count=8'));

      expect(payload.products).to.have.lengthOf(8);
      payload.products.forEach((producto) => {
        expectProductShape(producto);
        const esperado = producto.stock > 0 ? 'available' : 'out_of_stock';
        expect(producto.status).to.equal(esperado);
      });
    });

    it('genera pedidos con estados, prioridades y totales validos', async () => {
      const payload = expectSuccess(await request.get('/api/mocks/orders?count=6'));

      expect(payload.orders).to.have.lengthOf(6);
      payload.orders.forEach((pedido) => {
        expectOrderShape(pedido);
        expect(Object.values(ORDER_STATUS)).to.include(pedido.status);
        expect(Object.values(ORDER_PRIORITY)).to.include(pedido.priority);
        expect(pedido.user, 'todo pedido tiene que apuntar a un usuario').to.exist;
      });
    });

    it('genera entregas asociadas a un pedido y coherentes con el repartidor', async () => {
      const payload = expectSuccess(await request.get('/api/mocks/deliveries?count=10'));

      expect(payload.deliveries).to.have.lengthOf(10);
      payload.deliveries.forEach((entrega) => {
        expectDeliveryShape(entrega);
        expect(entrega.order, 'toda entrega tiene que apuntar a un pedido').to.exist;
      });
    });

    it('genera un dataset completo con las relaciones bien armadas', async () => {
      const payload = expectSuccess(
        await request.get('/api/mocks/dataset?users=4&couriers=2&products=6&orders=5')
      );

      expect(payload.users).to.have.lengthOf(4);
      expect(payload.couriers).to.have.lengthOf(2);
      expect(payload.products).to.have.lengthOf(6);
      expect(payload.orders).to.have.lengthOf(5);
      expect(payload.deliveries, 'una entrega por pedido').to.have.lengthOf(5);

      const idsUsuarios = payload.users.map((u) => String(u._id));
      payload.orders.forEach((pedido) => expect(idsUsuarios).to.include(String(pedido.user)));

      const idsPedidos = payload.orders.map((o) => String(o._id));
      payload.deliveries.forEach((entrega) => expect(idsPedidos).to.include(String(entrega.order)));

      const idsRepartidores = payload.couriers.map((c) => String(c._id));
      payload.deliveries
        .filter((entrega) => entrega.courier)
        .forEach((entrega) => expect(idsRepartidores).to.include(String(entrega.courier)));

      expect(payload.relations).to.include.all.keys(
        'ordersPerUser',
        'deliveriesWithCourier',
        'deliveriesPendingAssignment',
        'couriersAvailable'
      );
    });

    it('usa el valor por defecto cuando no se envia count', async () => {
      const payload = expectSuccess(await request.get('/api/mocks/users'));

      expect(payload.count).to.equal(MOCK_LIMITS.DEFAULT_COUNT);
    });

    it('NO escribe nada en la base', async () => {
      await request.get('/api/mocks/users?count=20');
      await request.get('/api/mocks/orders?count=20');
      await request.get('/api/mocks/dataset?users=10&orders=10');

      const resumen = expectSuccess(await request.get('/api/mocks/summary'));

      expect(resumen).to.deep.equal({ users: 0, couriers: 0, products: 0, orders: 0, deliveries: 0 });
    });
  });

  describe('Cantidades invalidas', () => {
    const casos = [
      ['negativa', '-5', 'no puede ser negativo'],
      ['decimal', '2.5', 'entero'],
      ['no numerica', 'diez', 'no es un numero'],
      ['cero', '0', 'mayor a 0'],
      ['por encima del maximo', String(MOCK_LIMITS.MAX_COUNT + 1), 'maximo'],
    ];

    casos.forEach(([nombre, valor, fragmentoDelMensaje]) => {
      it(`rechaza una cantidad ${nombre}`, async () => {
        const res = await request.get(`/api/mocks/users?count=${valor}`);

        const error = expectError(res, 400, 'INVALID_MOCK_COUNT');
        expect(error.message.toLowerCase()).to.contain(fragmentoDelMensaje);
        expect(error.details).to.include({ field: 'count', max: MOCK_LIMITS.MAX_COUNT });
      });
    });

    it('rechaza una cantidad invalida tambien en el dataset', async () => {
      const res = await request.get('/api/mocks/dataset?orders=-3');

      const error = expectError(res, 400, 'INVALID_MOCK_COUNT');
      expect(error.details).to.have.property('field', 'orders');
    });

    it('rechaza una cantidad invalida en el body de la carga', async () => {
      const res = await request.post('/api/mocks/generateData').set(asAdmin).send({ users: -1 });

      const error = expectError(res, 400, 'INVALID_MOCK_COUNT');
      expect(error.details).to.have.property('field', 'users');
    });

    it('rechaza un valor que no es un numero en el body', async () => {
      const res = await request.post('/api/mocks/generateData').set(asAdmin).send({ users: [5] });

      expectError(res, 400, 'INVALID_MOCK_COUNT');
    });
  });

  describe('POST /api/mocks/generateData', () => {
    it('inserta el lote pedido en la base', async () => {
      const res = await request
        .post('/api/mocks/generateData')
        .set(asAdmin)
        .send({ users: 3, couriers: 2, products: 4, orders: 3, deliveries: 3 });

      const payload = expectSuccess(res, 201);

      expect(payload.inserted).to.deep.equal({ users: 3, couriers: 2, products: 4, orders: 3, deliveries: 3 });
      expect(payload.credentials).to.have.property('password', MOCK_LIMITS.DEFAULT_PASSWORD);
      expect(payload.credentials.sampleEmail).to.be.a('string');

      const resumen = expectSuccess(await request.get('/api/mocks/summary'));
      expect(resumen).to.deep.equal({ users: 3, couriers: 2, products: 4, orders: 3, deliveries: 3 });
    });

    it('deja los datos accesibles desde los endpoints reales', async () => {
      await generateMockData({ users: 2, couriers: 1, products: 5, orders: 2, deliveries: 2 });

      const productos = expectSuccess(await request.get('/api/products?limit=50'));
      expect(productos.pagination.total).to.equal(5);

      const pedidos = expectSuccess(await request.get('/api/orders?limit=50'));
      expect(pedidos.pagination.total).to.equal(2);
    });

    it('permite iniciar sesion con un usuario simulado', async () => {
      const payload = await generateMockData({ users: 1, couriers: 0, products: 1, orders: 0, deliveries: 0 });

      const res = await request
        .post('/api/users/login')
        .send({ email: payload.credentials.sampleEmail, password: MOCK_LIMITS.DEFAULT_PASSWORD });

      expectSuccess(res, 200);
    });

    it('genera entregas coherentes con su estado', async () => {
      await generateMockData({ users: 2, couriers: 2, products: 3, orders: 5, deliveries: 5 });

      const payload = expectSuccess(await request.get('/api/deliveries?limit=50'));

      payload.deliveries.forEach(expectDeliveryShape);
      expect(payload.deliveries).to.have.lengthOf(5);
    });

    it('reutiliza los datos existentes cuando se piden 0 usuarios y 0 productos', async () => {
      await generateMockData({ users: 2, couriers: 1, products: 3, orders: 1, deliveries: 1 });

      const res = await request
        .post('/api/mocks/generateData')
        .set(asAdmin)
        .send({ users: 0, couriers: 0, products: 0, orders: 2, deliveries: 2 });

      const payload = expectSuccess(res, 201);
      expect(payload.inserted).to.include({ users: 0, products: 0, orders: 2 });
    });

    it('rechaza la carga si no hay usuarios con los que relacionar los pedidos', async () => {
      const res = await request
        .post('/api/mocks/generateData')
        .set(asAdmin)
        .send({ users: 0, couriers: 0, products: 0, orders: 3, deliveries: 0 });

      expectError(res, 400, 'MOCK_MISSING_USERS');
    });

    it('rechaza la carga si no hay productos con los que armar los pedidos', async () => {
      await createUser();

      const res = await request
        .post('/api/mocks/generateData')
        .set(asAdmin)
        .send({ users: 0, couriers: 0, products: 0, orders: 3, deliveries: 0 });

      expectError(res, 400, 'MOCK_MISSING_PRODUCTS');
    });

    it('rechaza generar entregas sin pedidos', async () => {
      const res = await request
        .post('/api/mocks/generateData')
        .set(asAdmin)
        .send({ users: 2, products: 2, orders: 0, deliveries: 2 });

      expectError(res, 400, 'MOCK_MISSING_ORDERS');
    });

    it('no escribe nada cuando la carga se rechaza', async () => {
      await request
        .post('/api/mocks/generateData')
        .set(asAdmin)
        .send({ users: 0, couriers: 0, products: 0, orders: 3, deliveries: 0 });

      const resumen = expectSuccess(await request.get('/api/mocks/summary'));
      expect(resumen).to.deep.equal({ users: 0, couriers: 0, products: 0, orders: 0, deliveries: 0 });
    });

    it('rechaza la carga a quien no es administrador', async () => {
      const res = await request.post('/api/mocks/generateData').set(asUser).send({ users: 2 });

      expectError(res, 403, 'FORBIDDEN_ROLE');
    });
  });

  describe('DELETE /api/mocks', () => {
    it('borra solo los datos simulados y respeta los reales', async () => {
      await generateMockData({ users: 2, couriers: 1, products: 3, orders: 1, deliveries: 1 });
      const usuarioReal = await createUser();

      const payload = expectSuccess(await request.delete('/api/mocks').set(asAdmin));
      expect(payload.deleted).to.include.all.keys('users', 'products', 'orders', 'deliveries');

      const resumen = expectSuccess(await request.get('/api/mocks/summary'));
      expect(resumen).to.deep.equal({ users: 0, couriers: 0, products: 0, orders: 0, deliveries: 0 });

      const sobreviviente = expectSuccess(await request.get(`/api/users/${usuarioReal._id}`).set(asAdmin));
      expect(sobreviviente._id).to.equal(usuarioReal._id);
    });

    it('rechaza la limpieza a quien no es administrador', async () => {
      const res = await request.delete('/api/mocks').set(asUser);

      expectError(res, 403, 'FORBIDDEN_ROLE');
    });
  });
});
