/**
 * Tests funcionales de Usuarios.
 *
 * Cada test crea los datos que necesita y los root hooks vacian las colecciones
 * al terminar: ninguno depende del orden de ejecucion ni de lo que dejo otro.
 */
const { expect } = require('chai');

const { request, asAdmin, asUser, asSelf } = require('./helpers/request');
const { createUser, createCourier, buildUser, PASSWORD, ID_INEXISTENTE } = require('./helpers/fixtures');
const { expectSuccess, expectError, expectPagination, expectUserShape } = require('./helpers/assertions');
const { USER_ROLES } = require('../src/constants');

describe('Users - /api/users', () => {
  describe('GET /api/users', () => {
    it('devuelve el listado paginado para un administrador', async () => {
      await createUser();
      await createUser();

      const res = await request.get('/api/users').set(asAdmin);
      const payload = expectSuccess(res, 200);

      expect(payload).to.have.property('users').that.is.an('array');
      expect(payload.users).to.have.lengthOf(2);
      expectPagination(payload.pagination);
      expect(payload.pagination.total).to.equal(2);

      payload.users.forEach(expectUserShape);
    });

    it('incluye el campo derivado fullName', async () => {
      await createUser({ firstName: 'Grace', lastName: 'Hopper' });

      const payload = expectSuccess(await request.get('/api/users').set(asAdmin));

      expect(payload.users[0]).to.have.property('fullName', 'Grace Hopper');
    });

    it('filtra por rol', async () => {
      await createUser();
      await createCourier();

      const payload = expectSuccess(await request.get(`/api/users?role=${USER_ROLES.COURIER}`).set(asAdmin));

      expect(payload.users).to.have.lengthOf(1);
      expect(payload.users[0].role).to.equal(USER_ROLES.COURIER);
    });

    it('respeta el limite de paginacion', async () => {
      await createUser();
      await createUser();
      await createUser();

      const payload = expectSuccess(await request.get('/api/users?limit=2&page=1').set(asAdmin));

      expect(payload.users).to.have.lengthOf(2);
      expect(payload.pagination.total).to.equal(3);
      expect(payload.pagination.totalPages).to.equal(2);
      expect(payload.pagination.hasNextPage).to.equal(true);
      expect(payload.pagination.hasPrevPage).to.equal(false);
    });

    it('rechaza el acceso a un usuario sin permisos de administrador', async () => {
      const res = await request.get('/api/users').set(asUser);

      const error = expectError(res, 403, 'FORBIDDEN_ROLE');
      expect(error.details).to.include({ requiredRole: USER_ROLES.ADMIN, receivedRole: USER_ROLES.USER });
    });

    it('rechaza un rol inexistente como filtro', async () => {
      const res = await request.get('/api/users?role=jefe').set(asAdmin);

      const error = expectError(res, 400, 'INVALID_ROLE');
      expect(error.details).to.have.property('received', 'jefe');
      expect(error.details.allowed).to.have.members(Object.values(USER_ROLES));
    });
  });

  describe('POST /api/users', () => {
    it('registra un usuario con datos validos', async () => {
      const nuevo = buildUser({ firstName: 'Ada', lastName: 'Lovelace' });

      const res = await request.post('/api/users').send(nuevo);
      const payload = expectSuccess(res, 201);

      expectUserShape(payload);
      expect(payload.email).to.equal(nuevo.email.toLowerCase());
      expect(payload.role).to.equal(USER_ROLES.USER);
      expect(payload).to.have.property('fullName', 'Ada Lovelace');
    });

    it('normaliza el email a minusculas', async () => {
      const nuevo = buildUser({ email: 'MAYUSCULAS@ShipNow.TEST' });

      const payload = expectSuccess(await request.post('/api/users').send(nuevo), 201);

      expect(payload.email).to.equal('mayusculas@shipnow.test');
    });

    it('rechaza el alta con campos incompletos', async () => {
      const res = await request.post('/api/users').send({ firstName: 'Solo el nombre' });

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details).to.be.an('array');
      expect(error.details.map((d) => d.field)).to.have.members(['lastName', 'email', 'password']);
    });

    it('rechaza un email con formato invalido', async () => {
      const res = await request.post('/api/users').send(buildUser({ email: 'no-es-un-email' }));

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details[0]).to.have.property('field', 'email');
    });

    it('rechaza una contrasena de menos de 8 caracteres', async () => {
      const res = await request.post('/api/users').send(buildUser({ password: '123' }));

      const error = expectError(res, 400, 'VALIDATION_ERROR');
      expect(error.details[0]).to.have.property('field', 'password');
    });

    it('rechaza un email ya registrado', async () => {
      const existente = await createUser();

      const res = await request.post('/api/users').send(buildUser({ email: existente.email }));

      const error = expectError(res, 409, 'USER_EMAIL_IN_USE');
      expect(error.details).to.have.property('email', existente.email);
    });

    it('impide elegir el rol si quien registra no es administrador', async () => {
      const res = await request.post('/api/users').send(buildUser({ role: USER_ROLES.ADMIN }));

      expectError(res, 403, 'FORBIDDEN_ROLE');
    });

    it('permite a un administrador crear un repartidor', async () => {
      const res = await request.post('/api/users').set(asAdmin).send(buildUser({ role: USER_ROLES.COURIER }));

      const payload = expectSuccess(res, 201);
      expect(payload.role).to.equal(USER_ROLES.COURIER);
    });
  });

  describe('POST /api/users/login', () => {
    it('acepta credenciales correctas y no devuelve la contrasena', async () => {
      const usuario = await createUser();

      const res = await request.post('/api/users/login').send({ email: usuario.email, password: PASSWORD });

      const payload = expectSuccess(res, 200);
      expectUserShape(payload);
      expect(payload.email).to.equal(usuario.email);
    });

    it('rechaza una contrasena incorrecta', async () => {
      const usuario = await createUser();

      const res = await request.post('/api/users/login').send({ email: usuario.email, password: 'incorrecta' });

      expectError(res, 401, 'INVALID_CREDENTIALS');
    });

    it('rechaza un email que no existe', async () => {
      const res = await request.post('/api/users/login').send({ email: 'nadie@shipnow.test', password: PASSWORD });

      expectError(res, 401, 'INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/users/:uid', () => {
    it('devuelve el usuario solicitado a un administrador', async () => {
      const usuario = await createUser();

      const payload = expectSuccess(await request.get(`/api/users/${usuario._id}`).set(asAdmin));

      expectUserShape(payload);
      expect(payload._id).to.equal(usuario._id);
    });

    it('permite a un usuario ver su propio perfil', async () => {
      const usuario = await createUser();

      const payload = expectSuccess(await request.get(`/api/users/${usuario._id}`).set(asSelf(usuario._id)));

      expect(payload._id).to.equal(usuario._id);
    });

    it('impide ver el perfil de otro usuario', async () => {
      const propio = await createUser();
      const ajeno = await createUser();

      const res = await request.get(`/api/users/${ajeno._id}`).set(asSelf(propio._id));

      expectError(res, 403, 'FORBIDDEN_ROLE');
    });

    it('devuelve 404 ante un usuario inexistente', async () => {
      const res = await request.get(`/api/users/${ID_INEXISTENTE}`).set(asAdmin);

      expectError(res, 404, 'USER_NOT_FOUND');
    });
  });

  describe('PATCH /api/users/:uid/role', () => {
    it('permite a un administrador cambiar el rol', async () => {
      const usuario = await createUser();

      const res = await request
        .patch(`/api/users/${usuario._id}/role`)
        .set(asAdmin)
        .send({ role: USER_ROLES.COURIER });

      const payload = expectSuccess(res, 200);
      expect(payload.role).to.equal(USER_ROLES.COURIER);
    });

    it('rechaza un rol que no existe', async () => {
      const usuario = await createUser();

      const res = await request.patch(`/api/users/${usuario._id}/role`).set(asAdmin).send({ role: 'jefe' });

      expectError(res, 400, 'INVALID_ROLE');
    });

    it('protege al ultimo administrador activo', async () => {
      const admin = await createUser({ role: USER_ROLES.ADMIN });

      const res = await request.patch(`/api/users/${admin._id}/role`).set(asAdmin).send({ role: USER_ROLES.USER });

      expectError(res, 409, 'LAST_ADMIN');
    });
  });

  describe('DELETE /api/users/:uid', () => {
    it('da de baja al usuario y deja de listarlo', async () => {
      const usuario = await createUser();

      const payload = expectSuccess(await request.delete(`/api/users/${usuario._id}`).set(asAdmin));
      expect(payload).to.have.property('deleted');

      const listado = expectSuccess(await request.get('/api/users').set(asAdmin));
      expect(listado.users.map((u) => u._id)).to.not.include(usuario._id);
    });

    it('rechaza la baja a quien no es administrador', async () => {
      const usuario = await createUser();

      const res = await request.delete(`/api/users/${usuario._id}`).set(asUser);

      expectError(res, 403, 'FORBIDDEN_ROLE');
    });
  });
});
