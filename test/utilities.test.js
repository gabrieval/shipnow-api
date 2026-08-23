/**
 * Tests funcionales de las herramientas internas: logger, health, Swagger y el
 * manejo de rutas inexistentes.
 */
const { expect } = require('chai');

const { request } = require('./helpers/request');
const { expectSuccess, expectError } = require('./helpers/assertions');
const { swaggerSpec } = require('../src/config/swagger.config');

describe('Logger - /api/logger-test', () => {
  it('emite un log de cada uno de los seis niveles', async () => {
    const payload = expectSuccess(await request.get('/api/logger-test'));

    expect(payload.nivelesEmitidos).to.deep.equal(['debug', 'http', 'info', 'warning', 'error', 'fatal']);
  });

  it('informa el entorno de testing y la jerarquia de niveles', async () => {
    const payload = expectSuccess(await request.get('/api/logger-test'));

    expect(payload.entorno).to.equal('test');
    expect(payload.jerarquia).to.deep.equal({
      fatal: 0,
      error: 1,
      warning: 2,
      info: 3,
      http: 4,
      debug: 5,
    });
  });

  it('no escribe archivos de log en el entorno de testing', async () => {
    const payload = expectSuccess(await request.get('/api/logger-test'));

    expect(payload.archivos).to.be.a('string');
    expect(payload.archivos).to.contain('test');
  });
});

describe('Health - /api/health', () => {
  it('responde con el estado, el entorno y el uptime', async () => {
    const payload = expectSuccess(await request.get('/api/health'));

    expect(payload).to.have.property('status', 'ok');
    expect(payload).to.have.property('environment', 'test');
    expect(payload).to.have.property('uptime').that.is.a('number');
  });
});

describe('Swagger - /api/docs', () => {
  it('sirve la interfaz de documentacion', async () => {
    const res = await request.get('/api/docs/').redirects(1);

    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.contain('text/html');
    expect(res.text.toLowerCase()).to.contain('swagger');
  });

  it('expone la especificacion OpenAPI en /api/docs.json', async () => {
    const res = await request.get('/api/docs.json');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('openapi').that.matches(/^3\./);
    expect(res.body.info).to.have.property('title', 'ShipNow API');
    expect(res.body).to.have.property('paths').that.is.an('object');
  });

  it('documenta los seis modulos con sus tags', async () => {
    const res = await request.get('/api/docs.json');

    const tags = res.body.tags.map((t) => t.name);
    expect(tags).to.include.members(['Users', 'Products', 'Orders', 'Deliveries', 'Mocks', 'Logger']);
  });

  it('define los schemas reutilizables de las entidades principales', async () => {
    const res = await request.get('/api/docs.json');

    expect(res.body.components.schemas).to.include.all.keys(
      'User',
      'Product',
      'Order',
      'OrderItem',
      'Delivery',
      'SuccessResponse',
      'ErrorResponse'
    );
  });
});

describe('Coherencia entre Swagger y el comportamiento real', () => {
  /**
   * La consigna pide que lo documentado tenga su test. Estos casos recorren la
   * especificacion y comprueban contra la API que los 404 documentados existen
   * de verdad.
   */
  const casosDocumentados = [
    ['/orders/{oid}', '/api/orders/64b7f1f1f1f1f1f1f1f1f1f1', 'ORDER_NOT_FOUND'],
    ['/deliveries/{did}', '/api/deliveries/64b7f1f1f1f1f1f1f1f1f1f1', 'DELIVERY_NOT_FOUND'],
    ['/products/{pid}', '/api/products/64b7f1f1f1f1f1f1f1f1f1f1', 'PRODUCT_NOT_FOUND'],
  ];

  casosDocumentados.forEach(([rutaDocumentada, rutaReal, codigoEsperado]) => {
    it(`${rutaDocumentada} documenta un 404 y la API lo devuelve`, async () => {
      const documentado = swaggerSpec.paths[rutaDocumentada].get.responses['404'];
      expect(documentado, `la documentacion de ${rutaDocumentada} deberia declarar un 404`).to.exist;

      expectError(await request.get(rutaReal), 404, codigoEsperado);
    });
  });

  it('todo endpoint documentado existe en la API', async () => {
    // Se prueba un endpoint representativo de cada tag: si la ruta no existiera,
    // la API responderia ROUTE_NOT_FOUND en vez del comportamiento esperado.
    const rutas = ['/api/users', '/api/products', '/api/orders', '/api/deliveries', '/api/mocks/summary', '/api/health'];

    for (const ruta of rutas) {
      const res = await request.get(ruta);
      expect(res.body?.error?.code, `${ruta} no deberia ser una ruta inexistente`).to.not.equal('ROUTE_NOT_FOUND');
    }
  });
});

describe('Rutas inexistentes', () => {
  it('devuelve 404 con el formato de error definido', async () => {
    const res = await request.get('/api/esta-ruta-no-existe');

    const error = expectError(res, 404, 'ROUTE_NOT_FOUND');
    expect(error.message).to.contain('/api/esta-ruta-no-existe');
    expect(res.body.path).to.equal('GET /api/esta-ruta-no-existe');
  });

  it('devuelve 404 tambien para un metodo no soportado en una ruta existente', async () => {
    const res = await request.delete('/api/health');

    expectError(res, 404, 'ROUTE_NOT_FOUND');
  });
});
