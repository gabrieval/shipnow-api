/**
 * Configuracion de Swagger / OpenAPI 3.0.
 *
 * Deliberadamente separada de la logica de rutas: aca vive la informacion
 * general y las opciones de swagger-jsdoc, y la descripcion de cada endpoint
 * esta en archivos YAML bajo `src/docs/`. Los archivos de `routes/` siguen
 * teniendo una linea por endpoint, sin un solo comentario de documentacion.
 */
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const config = require('./env.config');
const { version } = require('../../package.json');

/** Tags: agrupan los endpoints por modulo dentro de Swagger UI. */
const tags = [
  { name: 'Users', description: 'Alta, consulta y administracion de usuarios y repartidores' },
  { name: 'Products', description: 'Catalogo de ShipNow: alta, listado, stock y baja logica' },
  { name: 'Orders', description: 'Pedidos: consulta y avance del ciclo de vida' },
  { name: 'Deliveries', description: 'Entregas: consulta, cambio de estado y asignacion de repartidor' },
  { name: 'Uploads', description: 'Carga de documentos de usuario y comprobantes de pedidos y entregas' },
  { name: 'Mocks', description: 'Generacion de datos simulados y carga controlada de datos de prueba' },
  { name: 'Logger', description: 'Herramientas internas de verificacion: logger y estado de la API' },
];

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'ShipNow API',
      version,
      description: [
        'API de logistica de ShipNow, construida en arquitectura por capas',
        '(Controller -> Service -> Repository).',
        '',
        '**Proposito**: gestionar el catalogo de productos, los usuarios y repartidores,',
        'los pedidos y sus entregas, con un modulo de datos de prueba para poder trabajar',
        'sin cargar informacion a mano.',
        '',
        '### Como probar los endpoints',
        '',
        'Todavia no hay autenticacion (llega en un modulo posterior), asi que el rol de quien',
        'ejecuta la peticion se simula con headers. Para probar cualquier endpoint que pida',
        'permisos de administrador, agrega:',
        '',
        '- `x-user-role: admin`',
        '- `x-user-id: <id del usuario>` (solo hace falta para ver o editar el perfil propio)',
        '',
        'Si no se envia el header, la API asume el rol `user`.',
        '',
        '### Punto de partida sugerido',
        '',
        '1. `POST /api/mocks/generateData` con rol admin, para tener datos con los que trabajar.',
        '2. `GET /api/products` y `GET /api/orders` para ver lo que se genero.',
        '3. `GET /api/logger-test` para comprobar el sistema de logs.',
        '',
        '### Formato de las respuestas',
        '',
        'Todas las respuestas exitosas tienen la forma `{ status: "success", payload: ... }`',
        'y todos los errores `{ status: "error", error: { code, message, details? }, timestamp, path }`.',
      ].join('\n'),
      contact: { name: 'Gabriela Valenzuela' },
      license: { name: 'ISC' },
    },
    servers: [
      { url: `http://localhost:${config.port}/api`, description: 'Servidor local de desarrollo' },
    ],
    tags,
  },
  // Solo YAML: ni una anotacion de Swagger dentro del codigo de la aplicacion.
  // Las barras se normalizan porque en Windows `path.resolve` devuelve `\`, que
  // el glob interpreta como escape y no encontraria ningun archivo.
  apis: [path.resolve(__dirname, '../docs/**/*.yaml').replace(/\\/g, '/')],
};

const swaggerSpec = swaggerJsdoc(options);

/** Opciones visuales de Swagger UI. */
const swaggerUiOptions = {
  customSiteTitle: 'ShipNow API - Documentacion',
  swaggerOptions: {
    docExpansion: 'none',
    filter: true,
    tagsSorter: 'alpha',
    persistAuthorization: true,
  },
};

module.exports = { swaggerSpec, swaggerUiOptions, tags };
