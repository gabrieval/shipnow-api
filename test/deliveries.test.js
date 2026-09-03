/**
 * Tests funcionales de Entregas.
 *
 * Las entregas se crean desde el modulo de mocks (la API no expone un POST),
 * asi que los tests generan un lote controlado y trabajan sobre el.
 */
const { expect } = require('chai');

const { request, asAdmin, asUser } = require('./helpers/request');
const { createUser, createCourier, generateMockData, ID_INEXISTENTE } = require('./helpers/fixtures');
const {
  expectSuccess,
  expectError,
  expectPagination,
  expectDeliveryShape,
} = require('./helpers/assertions');
const { DELIVERY_STATUS, USER_ROLES } = require('../src/constants');

/** Devuelve una entrega del lote generado, en estado pendiente de asignacion. */
async function unaEntregaSinRepartidor() {
  await generateMockData({ users: 1, couriers: 0, products: 2, orders: 1, deliveries: 1 });

  const payload = expectSuccess(await request.get('/api/deliveries?limit=50'));
  const entrega = payload.deliveries.find((d) => !d.courier);
  expect(entrega, 'sin repartidores en el lote, la entrega debe quedar pendiente de asignacion').to.exist;
  return entrega;
}

describe('Deliveries - /api/deliveries', () => {
  describe('GET /api/deliveries', () => {
    it('devuelve el listado paginado con las relaciones resueltas', async () => {
      await generateMockData({ users: 2, couriers: 1, products: 3, orders: 2, deliveries: 2 });

      const payload = expectSuccess(await request.get('/api/deliveries'));

      expect(payload.deliveries).to.be.an('array').with.lengthOf(2);
      expectPagination(payload.pagination);
      expect(payload.summary).to.have.property('pendingAssignment').that.is.a('number');

      payload.deliveries.forEach((entrega) => {
        expectDeliveryShape(entrega);
        expect(entrega.order, 'el pedido tiene que venir resuelto').to.be.an('object');
        expect(entrega.order).to.have.property('code');
      });
    });

    it('filtra las entregas sin repartidor asignado', async () => {
      await generateMockData({ users: 1, couriers: 0, products: 2, orders: 2, deliveries: 2 });

      const payload = expectSuccess(await request.get('/api/deliveries?unassigned=true'));

      expect(payload.deliveries).to.have.length.greaterThan(0);
      payload.deliveries.forEach((entrega) => expect(entrega.courier).to.equal(null));
    });

    it('rechaza un estado invalido como filtro', async () => {
      const res = await request.get('/api/deliveries?status=volando');

      const error = expectError(res, 400, 'INVALID_DELIVERY_STATUS');
      expect(error.details.allowed).to.have.members(Object.values(DELIVERY_STATUS));
    });
  });

  describe('GET /api/deliveries/:did', () => {
    it('devuelve la entrega solicitada', async () => {
      const entrega = await unaEntregaSinRepartidor();

      const payload = expectSuccess(await request.get(`/api/deliveries/${entrega._id}`));

      expectDeliveryShape(payload);
      expect(payload._id).to.equal(entrega._id);
      expect(payload.trackingCode).to.equal(entrega.trackingCode);
    });

    it('devuelve 404 ante una entrega inexistente', async () => {
      const res = await request.get(`/api/deliveries/${ID_INEXISTENTE}`);

      expectError(res, 404, 'DELIVERY_NOT_FOUND');
    });
  });

  describe('GET /api/deliveries/tracking/:code', () => {
    it('encuentra la entrega por su codigo de seguimiento', async () => {
      const entrega = await unaEntregaSinRepartidor();

      const payload = expectSuccess(await request.get(`/api/deliveries/tracking/${entrega.trackingCode}`));

      expectDeliveryShape(payload);
      expect(payload._id).to.equal(entrega._id);
      expect(payload.trackingCode).to.equal(entrega.trackingCode);
      expect(payload.order, 'el pedido tiene que venir resuelto').to.be.an('object');
    });

    it('no distingue mayusculas de minusculas', async () => {
      const entrega = await unaEntregaSinRepartidor();

      const payload = expectSuccess(
        await request.get(`/api/deliveries/tracking/${entrega.trackingCode.toLowerCase()}`)
      );

      expect(payload.trackingCode).to.equal(entrega.trackingCode);
    });

    it('devuelve 404 ante un codigo inexistente', async () => {
      const res = await request.get('/api/deliveries/tracking/TRK-NO-EXISTE');

      expectError(res, 404, 'DELIVERY_NOT_FOUND');
    });
  });

  describe('PATCH /api/deliveries/:did/courier', () => {
    it('asigna un repartidor y deja la entrega en estado assigned', async () => {
      const entrega = await unaEntregaSinRepartidor();
      const repartidor = await createCourier();

      const res = await request
        .patch(`/api/deliveries/${entrega._id}/courier`)
        .set(asAdmin)
        .send({ courier: repartidor._id });

      const payload = expectSuccess(res, 200);
      expect(payload.status).to.equal(DELIVERY_STATUS.ASSIGNED);
      expect(payload.courier).to.be.an('object');
      expect(payload.courier).to.have.property('role', USER_ROLES.COURIER);
      expect(payload.assignedAt).to.not.equal(null);
    });

    it('rechaza asignar un usuario que no es repartidor', async () => {
      const entrega = await unaEntregaSinRepartidor();
      const usuarioComun = await createUser();

      const res = await request
        .patch(`/api/deliveries/${entrega._id}/courier`)
        .set(asAdmin)
        .send({ courier: usuarioComun._id });

      const error = expectError(res, 400, 'INVALID_ROLE');
      expect(error.details).to.have.property('received', USER_ROLES.USER);
      expect(error.details.allowed).to.have.members([USER_ROLES.COURIER]);
    });

    it('rechaza la asignacion sin el campo courier', async () => {
      const entrega = await unaEntregaSinRepartidor();

      const res = await request.patch(`/api/deliveries/${entrega._id}/courier`).set(asAdmin).send({});

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details[0]).to.have.property('field', 'courier');
    });

    it('rechaza la asignacion a quien no es administrador', async () => {
      const entrega = await unaEntregaSinRepartidor();
      const repartidor = await createCourier();

      const res = await request
        .patch(`/api/deliveries/${entrega._id}/courier`)
        .set(asUser)
        .send({ courier: repartidor._id });

      expectError(res, 403, 'FORBIDDEN_ROLE');
    });
  });

  describe('PATCH /api/deliveries/:did/status', () => {
    it('rechaza un estado que exige repartidor si la entrega no tiene uno', async () => {
      const entrega = await unaEntregaSinRepartidor();

      const res = await request
        .patch(`/api/deliveries/${entrega._id}/status`)
        .set(asAdmin)
        .send({ status: DELIVERY_STATUS.IN_TRANSIT });

      const error = expectError(res, 400, 'INVALID_DELIVERY_STATUS');
      expect(error.details.allowed).to.have.members([DELIVERY_STATUS.PENDING_ASSIGNMENT]);
    });

    it('permite avanzar el estado una vez asignado el repartidor', async () => {
      const entrega = await unaEntregaSinRepartidor();
      const repartidor = await createCourier();

      await request
        .patch(`/api/deliveries/${entrega._id}/courier`)
        .set(asAdmin)
        .send({ courier: repartidor._id });

      const payload = expectSuccess(
        await request
          .patch(`/api/deliveries/${entrega._id}/status`)
          .set(asAdmin)
          .send({ status: DELIVERY_STATUS.IN_TRANSIT })
      );

      expect(payload.status).to.equal(DELIVERY_STATUS.IN_TRANSIT);
    });

    it('completa deliveredAt al marcar la entrega como entregada', async () => {
      const entrega = await unaEntregaSinRepartidor();
      const repartidor = await createCourier();

      await request
        .patch(`/api/deliveries/${entrega._id}/courier`)
        .set(asAdmin)
        .send({ courier: repartidor._id });

      const payload = expectSuccess(
        await request
          .patch(`/api/deliveries/${entrega._id}/status`)
          .set(asAdmin)
          .send({ status: DELIVERY_STATUS.DELIVERED })
      );

      expect(payload.status).to.equal(DELIVERY_STATUS.DELIVERED);
      expect(payload.deliveredAt).to.not.equal(null);
    });

    it('rechaza un estado que no existe', async () => {
      const entrega = await unaEntregaSinRepartidor();

      const res = await request
        .patch(`/api/deliveries/${entrega._id}/status`)
        .set(asAdmin)
        .send({ status: 'teletransportada' });

      expectError(res, 400, 'INVALID_DELIVERY_STATUS');
    });

    it('devuelve 404 ante una entrega inexistente', async () => {
      const res = await request
        .patch(`/api/deliveries/${ID_INEXISTENTE}/status`)
        .set(asAdmin)
        .send({ status: DELIVERY_STATUS.PENDING_ASSIGNMENT });

      expectError(res, 404, 'DELIVERY_NOT_FOUND');
    });
  });
});
