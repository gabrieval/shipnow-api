/**
 * Tests de las piezas que preparan la API para produccion:
 * health check, limites de los listados y la puerta de los endpoints internos.
 */
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

const { request, asAdmin } = require('./helpers/request');
const { createProduct, createUser } = require('./helpers/fixtures');
const { expectSuccess, expectError } = require('./helpers/assertions');
const { config } = require('../src/config');
const { PAGINATION, UPLOAD_RULES } = require('../src/constants');

const RAIZ = path.resolve(__dirname, '..');

describe('Produccion - health check', () => {
  it('responde con estado, entorno, version, uptime, timestamp y base', async () => {
    const payload = expectSuccess(await request.get('/api/health'));

    expect(payload).to.have.property('status', 'ok');
    expect(payload).to.have.property('environment', 'test');
    expect(payload).to.have.property('version').that.is.a('string');
    expect(payload).to.have.property('uptime').that.is.a('number');
    expect(payload).to.have.property('timestamp').that.is.a('string');
    expect(new Date(payload.timestamp).toString()).to.not.equal('Invalid Date');
    expect(payload.database).to.equal('connected');
  });

  it('NO expone informacion sensible', async () => {
    const res = await request.get('/api/health');
    const cuerpo = JSON.stringify(res.body);

    // Ni la URI de la base, ni credenciales, ni rutas del servidor.
    expect(cuerpo).to.not.contain('mongodb://');
    expect(cuerpo).to.not.contain(config.mongodbUri);
    expect(cuerpo).to.not.match(/[A-Za-z]:\\/); // rutas de Windows
    expect(res.body.payload).to.not.have.any.keys('mongodbUri', 'env', 'config', 'saltRounds', 'password');
  });

  it('no necesita autenticacion ni rol', async () => {
    const res = await request.get('/api/health');
    expect(res.status).to.equal(200);
  });
});

describe('Produccion - limites en los listados', () => {
  const listados = ['/api/products', '/api/orders', '/api/deliveries'];

  listados.forEach((ruta) => {
    it(`${ruta} devuelve paginacion, nunca la coleccion entera`, async () => {
      const payload = expectSuccess(await request.get(ruta));

      expect(payload).to.have.property('pagination');
      expect(payload.pagination.limit).to.be.at.most(PAGINATION.MAX_LIMIT);
    });

    it(`${ruta} acota un limit desmedido al maximo permitido`, async () => {
      const payload = expectSuccess(await request.get(`${ruta}?limit=100000`));

      expect(payload.pagination.limit).to.equal(PAGINATION.MAX_LIMIT);
    });
  });

  it('/api/users tambien acota el limit', async () => {
    const payload = expectSuccess(await request.get('/api/users?limit=99999').set(asAdmin));

    expect(payload.pagination.limit).to.equal(PAGINATION.MAX_LIMIT);
  });

  it('aplica el tamano de pagina por defecto cuando no se pide limit', async () => {
    const payload = expectSuccess(await request.get('/api/products'));

    expect(payload.pagination.limit).to.equal(config.defaultPageSize);
  });

  it('no devuelve mas documentos que el limite pedido', async () => {
    await createProduct();
    await createProduct();
    await createProduct();

    const payload = expectSuccess(await request.get('/api/products?limit=2'));

    expect(payload.products).to.have.lengthOf(2);
    expect(payload.pagination.total).to.equal(3);
  });
});

describe('Produccion - endpoints internos', () => {
  it('en el entorno de testing estan habilitados', async () => {
    expect(config.enableInternal).to.equal(true);

    const res = await request.get('/api/mocks/summary');
    expect(res.status).to.equal(200);
  });

  it('el middleware responde 404 cuando estan deshabilitados', () => {
    // `config` esta congelado a proposito, asi que la bandera no se puede alterar
    // en caliente: el middleware se expone como fabrica para poder probar la
    // rama de "deshabilitado" sin depender del entorno.
    const { buildInternalOnly } = require('../src/middlewares/internal.middleware');
    const apagado = buildInternalOnly(false);

    let recibido = null;
    apagado({ method: 'GET', originalUrl: '/api/mocks/summary' }, {}, (error) => {
      recibido = error;
    });

    expect(recibido, 'deberia derivar un error').to.exist;
    expect(recibido.code).to.equal('ROUTE_NOT_FOUND');
    expect(recibido.status).to.equal(404);
    expect(recibido.message).to.contain('/api/mocks/summary');
  });

  it('el middleware deja pasar cuando estan habilitados', () => {
    const { buildInternalOnly } = require('../src/middlewares/internal.middleware');
    const encendido = buildInternalOnly(true);

    let llamadoSinError = false;
    encendido({ method: 'GET', originalUrl: '/api/mocks/summary' }, {}, (error) => {
      llamadoSinError = error === undefined;
    });

    expect(llamadoSinError).to.equal(true);
  });
});

describe('Produccion - configuracion por entorno', () => {
  it('expone las variables de configuracion esperadas', () => {
    expect(config).to.include.all.keys(
      'nodeEnv',
      'port',
      'mongodbUri',
      'logLevel',
      'publicUrl',
      'enableInternal',
      'enableDocs',
      'defaultPageSize',
      'saltRounds'
    );
  });

  it('el objeto de configuracion es inmutable', () => {
    expect(Object.isFrozen(config)).to.equal(true);
  });

  it('el nivel de log del entorno de testing es error', () => {
    expect(config.logLevel).to.equal('error');
  });

  it('.env.example documenta todas las variables que lee la configuracion', () => {
    const ejemplo = fs.readFileSync(path.join(RAIZ, '.env.example'), 'utf8');
    const fuente = fs.readFileSync(path.join(RAIZ, 'src/config/env.config.js'), 'utf8');

    const documentadas = [...ejemplo.matchAll(/^([A-Z_]+)=/gm)].map((m) => m[1]);
    const leidas = [...new Set([...fuente.matchAll(/(?:required|optional|parseBoolean)\('([A-Z_]+)'/g)].map((m) => m[1]))];

    const sinDocumentar = leidas.filter((v) => !documentadas.includes(v));
    expect(sinDocumentar, `faltan en .env.example: ${sinDocumentar.join(', ')}`).to.have.lengthOf(0);
  });

  it('no hay valores sensibles escritos en el codigo', () => {
    const fuente = fs.readFileSync(path.join(RAIZ, 'src/config/env.config.js'), 'utf8');

    // La URI real solo puede salir de una variable de entorno.
    expect(fuente).to.not.match(/mongodb(\+srv)?:\/\/[^'"`\s]*@/);
  });
});

describe('Produccion - limites de la carga de archivos', () => {
  it('define un tamano maximo y una lista cerrada de tipos', () => {
    expect(UPLOAD_RULES.MAX_FILE_SIZE).to.be.a('number').and.greaterThan(0);
    expect(UPLOAD_RULES.MAX_FILES).to.equal(1);
    expect(Object.keys(UPLOAD_RULES.ALLOWED_MIME_TYPES)).to.have.length.greaterThan(0);
  });

  it('los uploads del entorno de testing viven fuera de la carpeta real', () => {
    const { UPLOAD_ROOT } = require('../src/config/multer.config');
    expect(UPLOAD_ROOT).to.contain('uploads-test');
  });
});

describe('Produccion - Docker', () => {
  it('existen Dockerfile, .dockerignore y docker-compose.yml', () => {
    ['Dockerfile', '.dockerignore', 'docker-compose.yml'].forEach((archivo) => {
      expect(fs.existsSync(path.join(RAIZ, archivo)), `falta ${archivo}`).to.equal(true);
    });
  });

  it('el .dockerignore excluye lo que no debe entrar a la imagen', () => {
    const contenido = fs.readFileSync(path.join(RAIZ, '.dockerignore'), 'utf8');

    ['node_modules', '.env', '.git', 'logs', 'uploads', 'coverage', 'test'].forEach((entrada) => {
      expect(contenido, `.dockerignore deberia excluir ${entrada}`).to.contain(entrada);
    });
  });

  it('el Dockerfile no corre como root y expone el puerto', () => {
    const dockerfile = fs.readFileSync(path.join(RAIZ, 'Dockerfile'), 'utf8');

    expect(dockerfile).to.contain('USER node');
    expect(dockerfile).to.contain('EXPOSE');
    expect(dockerfile).to.contain('npm ci');
    expect(dockerfile, 'las dependencias de desarrollo no van a la imagen').to.contain('--omit=dev');
    expect(dockerfile).to.contain('HEALTHCHECK');
  });

  it('el Dockerfile no copia el .env', () => {
    const dockerfile = fs.readFileSync(path.join(RAIZ, 'Dockerfile'), 'utf8');

    expect(dockerfile).to.not.match(/^COPY\s+\.env/m);
    // Se copian carpetas puntuales, no el proyecto entero.
    expect(dockerfile).to.not.match(/^COPY\s+\.\s+\.\s*$/m);
  });

  it('el archivo de variables de Docker esta ignorado en Git', () => {
    const gitignore = fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8');

    expect(gitignore).to.contain('.env.docker');
    expect(fs.existsSync(path.join(RAIZ, '.env.docker.example')), 'deberia existir el ejemplo').to.equal(true);
  });
});
