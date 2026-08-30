# ShipNow API — Capas, mocking, errores, logs, docs, tests, archivos y Docker

Pre-entregas **Módulo 1** a **Módulo 8** — *Programación Backend III: Testing y Escalabilidad* (CoderHouse).

📖 **Documentación interactiva (Swagger UI): [`http://localhost:8080/api/docs`](http://localhost:8080/api/docs)**

API de ShipNow refactorizada desde un modelo monolítico a una arquitectura por capas
**Controller → Service → Repository**, con configuración de entorno validada al arranque,
un diccionario centralizado de constantes del dominio, un módulo de mocking que genera
usuarios, repartidores, pedidos y entregas de prueba, una capa común de errores que hace
que toda la API falle siempre de la misma forma, y un sistema de logging con Winston que deja
registro de lo que pasa adentro del servidor, documentada con Swagger/OpenAPI y cubierta por
una suite de **178 tests funcionales** con Mocha, Chai y Supertest, carga de documentos y
comprobantes con Multer, y la API contenerizada con Docker.

- **Módulo 1** — arquitectura por capas y configuración de entorno.
- **Módulo 2** — router `/api/mocks` con generación de datos simulados y carga controlada en MongoDB.
- **Módulo 3** — capa centralizada de manejo de errores: errores personalizados, diccionario y middleware global.
- **Módulo 4** — logging y monitoreo básico con Winston: seis niveles, persistencia en archivos con rotación y endpoint de prueba.
- **Módulo 5** — documentación de la API con Swagger/OpenAPI 3.0 en `/api/docs`.
- **Módulo 6** — testing funcional con Mocha, Chai y Supertest, con entorno de testing aislado.
- **Módulo 7** — carga de archivos con Multer: documentos de usuario y comprobantes de pedidos y entregas.
- **Módulo 8** — performance, configuración por entorno, health check y Docker.

---

## Requisitos

- Node.js >= 18 (probado con v22)
- MongoDB local (`mongodb://127.0.0.1:27017`) o un cluster de MongoDB Atlas

## Cómo correr el proyecto localmente

```bash
git clone <URL-DEL-REPOSITORIO>
```

```bash
cd shipnow-api && npm install
```

Crear el archivo `.env` a partir del ejemplo (el `.env` **no** está versionado):

```bash
cp .env.example .env
```

En Windows (PowerShell / CMD):

```bash
copy .env.example .env
```

Completar los valores:

```
NODE_ENV=development
PORT=8080
MONGODB_URI=mongodb://127.0.0.1:27017/shipnow
DEFAULT_PAGE_SIZE=10
BCRYPT_SALT_ROUNDS=10
```

Levantar el servidor:

```bash
npm run dev
```

O en modo producción:

```bash
npm start
```

Opcional — cargar datos de prueba (2 usuarios y 4 productos):

```bash
npm run seed
```

Correr los tests (no hace falta tener MongoDB: levanta uno en memoria):

```bash
npm test
```

Verificar que responde:

```bash
curl http://localhost:8080/api/health
```

Y abrir la documentación interactiva en el navegador:

```
http://localhost:8080/api/docs
```

### Prueba de robustez

Si se borra o se deja vacía una variable crítica en el `.env`, la app **no arranca** y muestra
un error descriptivo con todos los problemas encontrados a la vez:

```
[config] No se pudo iniciar ShipNow: la configuracion de entorno es invalida.

- MONGODB_URI: falta definirla en el archivo .env

Solucion: copia el archivo .env.example como .env y completa los valores.
```

---

## Estructura del proyecto

```
src/
├── config/
│   ├── env.config.js      # dotenv + validación de entorno (ÚNICO uso de process.env)
│   ├── db.config.js       # conexión/desconexión de Mongoose
│   ├── logger.config.js   # Winston: niveles, formatos, transportes y rotación
│   ├── swagger.config.js  # OpenAPI: info general, tags y opciones de Swagger UI
│   ├── multer.config.js   # carga de archivos: destino, nombres, tipos y tamaño
│   └── index.js           # barrel de la capa de configuración
├── constants/
│   └── index.js           # USER_ROLES, ORDER_STATUS, DELIVERY_STATUS... (Object.freeze)
├── errors/                # capa centralizada de errores (Módulo 3)
│   ├── error.dictionary.js  # código -> { status HTTP, mensaje }
│   ├── AppError.js          # clase base: toma status y mensaje del diccionario
│   ├── domain.errors.js     # errores personalizados del dominio
│   ├── error.normalizer.js  # traduce errores de Mongoose a AppError
│   └── index.js
├── controllers/
│   ├── product.controller.js
│   ├── user.controller.js
│   ├── mock.controller.js
│   ├── order.controller.js
│   ├── delivery.controller.js
│   ├── health.controller.js
│   └── logger.controller.js  # endpoint de prueba del logger
├── services/
│   ├── product.service.js
│   ├── user.service.js
│   ├── order.service.js   # transiciones válidas del ciclo de vida del pedido
│   ├── delivery.service.js  # coherencia entrega <-> repartidor
│   ├── file.service.js    # metadatos, borrado del archivo si falla la asociación
│   └── mock.service.js    # orquesta el mocking: relaciones, totales, permisos
├── repositories/
│   ├── product.repository.js
│   ├── user.repository.js
│   ├── order.repository.js
│   └── delivery.repository.js
├── mocks/                 # generadores puros con faker (sin DB, sin Express)
│   ├── user.mock.js       # usuarios y repartidores
│   ├── product.mock.js
│   ├── order.mock.js
│   ├── delivery.mock.js
│   └── index.js
├── models/
│   ├── product.model.js   # solo esquema
│   ├── user.model.js
│   ├── order.model.js
│   ├── delivery.model.js
│   └── file.schema.js     # sub-esquema de metadatos de archivo, compartido
├── docs/                  # documentación OpenAPI en YAML, fuera del código
│   ├── components.yaml    # schemas, parámetros y respuestas de error reutilizables
│   ├── products.yaml
│   ├── users.yaml
│   ├── orders.yaml
│   ├── deliveries.yaml
│   ├── mocks.yaml
│   ├── uploads.yaml
│   └── logger.yaml
├── routes/
│   ├── index.js
│   ├── product.routes.js  # solo path -> método del controller
│   ├── user.routes.js
│   ├── order.routes.js
│   ├── delivery.routes.js
│   ├── mock.routes.js
│   └── docs.routes.js     # monta Swagger UI, sin documentación adentro
├── middlewares/
│   ├── requester.middleware.js  # deja quién ejecuta la request en req.requester
│   ├── upload.middleware.js     # middlewares de Multer ya armados por tipo
│   ├── http.middleware.js       # registra cada petición con nivel http
│   └── error.middleware.js      # manejo centralizado de errores + logging
├── utils/
│   ├── apiResponse.js     # formato único de respuesta (éxito y error)
│   └── constants.js       # alias que reexporta src/constants
├── scripts/
│   └── seed.js
├── app.js                 # arma la app Express (no abre puerto)
└── server.js              # valida config -> conecta DB -> escucha

test/                      # suite de tests funcionales (Módulo 6)
├── helpers/
│   ├── database.js        # MongoDB en memoria + limpieza de colecciones
│   ├── root-hooks.js      # conectar / limpiar / desconectar, para toda la suite
│   ├── request.js         # cliente Supertest sobre la app de Express
│   ├── fixtures.js        # datos de prueba controlados y repetibles
│   └── assertions.js      # aserciones sobre el contrato de la API
├── users.test.js
├── products.test.js
├── orders.test.js
├── deliveries.test.js
├── mocks.test.js
├── uploads.test.js
└── utilities.test.js      # logger, health, Swagger y rutas inexistentes

uploads/                   # archivos subidos (ignorados en Git)
├── README.md              # lo único versionado de esta carpeta
├── documents/<tipo>/      # documentos de usuario, separados por tipo
└── receipts/
    ├── orders/            # comprobantes de pago
    └── deliveries/        # comprobantes de entrega

logs/                      # archivos generados por Winston (ignorados en Git)
├── README.md              # lo único versionado de esta carpeta
├── error-YYYY-MM-DD.log
└── combined-YYYY-MM-DD.log
```

### Flujo de dependencias

```
Router  →  Controller  →  Service  →  Repository  →  Model (Mongoose)
                             ↑
                  constants / errors / mocks
```

- El **Controller** no importa Mongoose ni el modelo: no sabe si abajo hay Mongo, Postgres o un archivo.
- El **Service** no conoce `req` ni `res`: recibe datos planos y devuelve datos planos.
- El **Repository** es el único que importa el modelo de Mongoose.

---

## Por qué separé la lógica entre Service y Repository

La regla que usé para decidir dónde va cada cosa es simple:

> **Repository = "cómo y de dónde traigo/guardo los datos".
> Service = "qué significan esos datos para el negocio".**

Si mañana ShipNow migra de MongoDB a PostgreSQL, tengo que reescribir los repositories
y **ni una línea** de services, controllers o routers. Ese es el criterio que valida si la
separación está bien hecha.

**Qué puse en el Repository (y por qué no es un "pasamanos"):**

- **Filtro base de baja lógica.** Todas las consultas arrancan con `{ isActive: true }`.
  Ningún service tiene que acordarse de excluir los registros dados de baja: es una
  característica de *cómo guardamos* los datos, no una regla de negocio.
- **Proyecciones.** El `UserRepository` nunca devuelve el hash de la contraseña; hay un
  único método explícito (`getByEmailWithPassword`) que lo trae, y existe solo para el login.
  Que el campo `password` tenga `select: false` y que exista una vía controlada para leerlo
  es una decisión de acceso a datos.
- **Paginación y ordenamiento.** El `skip/limit/sort` y el `countDocuments` en paralelo son
  detalle de Mongoose; el service solo pide "página 2, 10 por página, ordenado por precio".
- **Operaciones atómicas.** `adjustStock` mete la condición `stock >= cantidad` dentro del
  filtro del `findOneAndUpdate`, para que dos compras simultáneas no dejen stock negativo.
  Esa garantía depende de lo que la base sabe hacer, así que vive acá.
- **Validación de formato de ObjectId**, para que un id basura no llegue nunca al driver.

**Qué dejé en el Service:**

- **Permisos.** "Solo un ADMIN modifica el catálogo", "un usuario solo puede ver su propio
  perfil". Es una regla de la empresa, no de la base de datos.
- **Estado derivado.** El `status` de un producto se calcula a partir del stock
  (`stock > 0 → AVAILABLE`, `stock === 0 → OUT_OF_STOCK`), salvo que esté `DISCONTINUED`,
  que es una decisión manual que pisa el cálculo. Si esta lógica estuviera en el repository,
  cada nuevo origen de datos tendría que reimplementarla.
- **Cálculos y campos derivados.** El `inventoryValue` del listado (`Σ precio × stock`) y el
  `fullName` del usuario se arman en el service: son información compuesta, no persistida.
- **Validaciones de dominio y unicidad.** Precio ≥ 0, stock entero, email con formato válido,
  contraseña de al menos 8 caracteres, código de producto y email únicos.
- **Hasheo de contraseñas.** Está en el service y **no** en un hook `pre('save')` del modelo,
  justamente para que la capa de persistencia no tome decisiones de seguridad del dominio.
- **Reglas que cruzan entidades.** "No se puede degradar ni eliminar al último administrador
  activo": el service pregunta al repository cuántos admins hay y decide; el repository solo
  cuenta.

El **Controller** quedó como una capa de traducción de ~5 líneas por endpoint: lee `req`,
llama al service, elige el status code y manda cualquier error a `next()`. Ningún `if` de
negocio vive ahí.

---

## Cómo encaja el mocking en la arquitectura por capas

El módulo de mocking no es un script suelto: se reparte entre las mismas capas que el resto
de la API, más una capa nueva de generadores.

```
mock.routes.js  →  mock.controller.js  →  mock.service.js  →  repositories/*  →  models/*
                                                ↓
                                            mocks/*.mock.js   (faker, funciones puras)
```

| Capa | Archivo | De qué se ocupa |
| --- | --- | --- |
| Router | `routes/mock.routes.js` | Solo `path → método del controller`. Ni un `faker`, ni un `if` |
| Controller | `controllers/mock.controller.js` | Lee `req.query` / `req.body` / `req.requester`, elige `200` o `201` |
| Service | `services/mock.service.js` | Valida cantidades, arma relaciones, calcula totales, hashea, marca `isMock`, controla permisos |
| Generadores | `mocks/*.mock.js` | Funciones puras: reciben datos y devuelven objetos planos. No conocen Mongoose ni Express |
| Repository | `repositories/*.repository.js` | `createMany` y `deleteMocks`: lo único que escribe en Mongo |

**Por qué hay una capa de generadores separada del Service.** Los archivos de `mocks/` no
deciden nada: `generateOrder()` recibe el usuario y los productos con los que tiene que armar
la relación, nunca sale a buscarlos. Eso los deja como funciones puras, testeables sin base de
datos ni servidor — que es justamente lo que va a hacer falta en el módulo de testing. Toda
decisión (cuántos generar, con qué se relacionan, qué se persiste) queda en el Service.

**Por qué no existe un `mock.repository.js`.** Un repositorio que tocara las cuatro colecciones
rompería la regla que sostiene todo el diseño: *un repositorio por entidad, y es el único que
conoce su modelo*. La persistencia de los datos de prueba se hace con `createMany()` y
`deleteMocks()` agregados a cada repositorio, que es donde corresponde: el `OrderRepository`
sigue siendo el único que sabe que existe `OrderModel`. El `MockService` los orquesta a los
cuatro, igual que cualquier otro service que necesite cruzar entidades.

**Reglas de negocio del mocking que viven en el Service, no en el generador:**

- El **total** de cada pedido se recalcula como la suma de los subtotales. El generador
  devuelve `total: 0` a propósito: inventar un total sería inventar una regla de negocio.
- El **hasheo** de las contraseñas (una sola pasada de bcrypt reutilizada para todo el lote,
  porque son datos de prueba que comparten contraseña).
- La marca **`isMock: true`**, que es lo que después permite limpiar sin tocar datos reales.
- El **preflight**: comprobar que el lote se pueda armar entero *antes* de escribir nada.
- La **verificación de coherencia** final: ninguna entrega puede quedar en un estado que
  exija repartidor (`assigned`, `in_transit`, `delivered`, `failed`, `returned`) sin tenerlo
  asignado. Si el generador no pudo cumplirlo, el service corta antes de insertar.

**Coherencia entre entidades.** El generador de entregas no elige el estado al azar sobre el
total de opciones: parte del estado del pedido y elige entre los estados de entrega
compatibles, para no producir combinaciones imposibles como *pedido pendiente / entrega
entregada*.

| Estado del pedido | Estados de entrega posibles                  |
| ----------------- | -------------------------------------------- |
| `pending`         | `pending_assignment`                         |
| `confirmed`       | `pending_assignment`, `assigned`             |
| `preparing`       | `assigned`                                   |
| `shipped`         | `in_transit`, `failed`                       |
| `delivered`       | `delivered`                                  |
| `cancelled`       | `pending_assignment`, `returned`             |

Además, `assignedAt` solo existe si hay repartidor y `deliveredAt` solo si la entrega llegó a
estado `delivered`.

---

## Producción y Docker

### Variables de entorno

Hay un archivo por entorno, y **ninguno se versiona**. Lo que sí está en el repo son los
ejemplos:

| Entorno | Archivo | Ejemplo versionado |
| --- | --- | --- |
| Desarrollo | `.env` | `.env.example` |
| Testing | `.env.test` | `.env.test.example` |
| Docker | `.env.docker` | `.env.docker.example` |

`src/config/env.config.js` elige cuál cargar según `NODE_ENV` y **valida todo al arranque**.

**Críticas** — si falta alguna, la app no arranca:

| Variable | Ejemplo | Validación |
| --- | --- | --- |
| `NODE_ENV` | `production` | Uno de `development`, `production`, `test` |
| `PORT` | `8080` | Entero entre 1 y 65535 |
| `MONGODB_URI` | `mongodb://mongo:27017/shipnow` | Debe empezar con `mongodb://` o `mongodb+srv://` |

**Opcionales** — tienen valor por defecto:

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `LOG_LEVEL` | `debug` / `info` / `error` según entorno | Nivel mínimo de log |
| `API_PUBLIC_URL` | `http://localhost:<PORT>` | URL que Swagger declara como servidor |
| `ENABLE_INTERNAL_ENDPOINTS` | `false` en producción, `true` en el resto | Habilita `/api/mocks` y `/api/logger-test` |
| `ENABLE_DOCS` | `true` | Habilita `/api/docs` |
| `HOST_PORT` | `8080` | Solo para Docker Compose: puerto del host donde se publica la API |
| `DEFAULT_PAGE_SIZE` | `10` | Documentos por página |
| `BCRYPT_SALT_ROUNDS` | `10` | Rondas de hashing |

**No hay secretos escritos en el código.** El proyecto todavía no consume APIs de terceros ni
emite tokens; cuando se incorpore autenticación, el `JWT_SECRET` va por variable de entorno.

Si falta una variable crítica, la app **no arranca** y explica exactamente qué falta:

```
[config] No se pudo iniciar ShipNow: la configuracion de entorno es invalida.

- MONGODB_URI: falta definirla en el archivo .env

Solucion: copia el archivo .env.example como .env y completa los valores.
```

### Health check

```bash
curl http://localhost:8080/api/health
```

```json
{
  "status": "success",
  "payload": {
    "status": "ok",
    "environment": "production",
    "version": "1.0.0",
    "uptime": 20.73,
    "timestamp": "2026-08-23T22:28:52.091Z",
    "database": "connected"
  }
}
```

**No expone nada sensible**: ni la URI de la base, ni variables de entorno, ni rutas del
servidor. Solo si la API responde y si el enlace con MongoDB está activo. Docker lo usa como
`HEALTHCHECK` del contenedor.

### Criterio sobre los endpoints internos

`/api/mocks` y `/api/logger-test` son herramientas de desarrollo: el primero **escribe y borra
datos en masa**, el segundo solo sirve para verificar la configuración de logs.

**En producción quedan deshabilitados por defecto** y responden `404 ROUTE_NOT_FOUND` — no
`403`, para no revelar que hay algo detrás. Se encienden a propósito con
`ENABLE_INTERNAL_ENDPOINTS=true`, por ejemplo en un entorno de staging.

| Endpoint | development / test | production |
| --- | --- | --- |
| `/api/mocks/*` | habilitado | **deshabilitado** (configurable) |
| `/api/logger-test` | habilitado | **deshabilitado** (configurable) |
| `/api/docs` | habilitado | habilitado (configurable con `ENABLE_DOCS`) |
| `/api/health` | habilitado | **siempre habilitado** |

Swagger queda encendido porque es de solo lectura y no expone datos. El health check queda
siempre encendido: apagarlo dejaría al orquestador sin forma de saber si la instancia está sana.

### Correr con Docker

Preparar las variables:

```bash
copy .env.docker.example .env.docker
```

Levantar la API junto con su MongoDB:

```bash
docker compose up --build
```

La API queda en **`http://localhost:8080`**.

Para publicarla en otro puerto del host, usar `HOST_PORT` (el puerto interno del contenedor
siempre es 8080):

```bash
HOST_PORT=8090 docker compose up --build
```

En PowerShell:

```bash
$env:HOST_PORT=8090; docker compose up --build
```

> **Por qué `HOST_PORT` y no `PORT`.** Compose interpola `${...}` desde el shell o desde un
> archivo `.env`, **no desde `env_file`**. Si el mapeo usara `${PORT}`, cambiar `PORT` en
> `.env.docker` movería el puerto del proceso dentro del contenedor pero no el publicado, y la
> API quedaría inalcanzable desde el host.

Ver que responde:

```bash
curl http://localhost:8080/api/health
```

Y la documentación en el navegador: `http://localhost:8080/api/docs`

Para apagar todo:

```bash
docker compose down
```

### Solo la imagen, sin Compose

```bash
docker build -t shipnow-api .
```

```bash
docker run -p 8080:8080 --env-file .env.docker -e MONGODB_URI=mongodb://host.docker.internal:27017/shipnow shipnow-api
```

Las variables se pasan **en tiempo de ejecución**, nunca dentro de la imagen.

### Qué hace el Dockerfile

- **Build en dos etapas**: la primera resuelve dependencias, la segunda arma la imagen final.
  Las herramientas de compilación de bcrypt y el caché de npm no quedan en la imagen desplegada.
- **`npm ci --omit=dev`**: instala exactamente lo del lockfile y deja fuera mocha, chai y
  supertest.
- **No corre como root**: usa el usuario `node`. Si alguien escapa del proceso, no es
  administrador del contenedor.
- **`tini` como PID 1**: reenvía las señales para que `SIGTERM` llegue a Node y el cierre
  ordenado del servidor funcione de verdad.
- **`HEALTHCHECK`**: consulta `/api/health`, así el orquestador sabe si la API está sana y no
  solo si el proceso vive.

### Qué NO va al repositorio ni a la imagen

`.gitignore` (repositorio) y `.dockerignore` (imagen) cubren:

| Qué | Por qué |
| --- | --- |
| `node_modules/` | Se instala en cada entorno |
| `.env`, `.env.test`, `.env.docker` | Contienen configuración del entorno; se versionan solo los `.example` |
| `logs/*` | Los genera la app; se versiona solo `logs/README.md` |
| `uploads/*`, `uploads-test/` | Los suben los usuarios; se versiona solo `uploads/README.md` |
| `test/`, `coverage/` | No van a la imagen de producción |
| `.git/` | No tiene sentido dentro de la imagen |

### Logs y uploads en el contenedor

Ambas carpetas están montadas como volúmenes en `docker-compose.yml`:

```yaml
volumes:
  - ./logs:/app/logs
  - ./uploads:/app/uploads
```

Sin eso, **los archivos subidos y los logs se perderían** cada vez que se recrea el contenedor,
porque el sistema de archivos de un contenedor es efímero. Para un despliegue real, `uploads/`
debería moverse a un almacenamiento externo (S3 o similar): el disco de un contenedor no es un
lugar donde guardar archivos de forma permanente.

---

## Performance

Lo que se revisó en el Módulo 8 y qué se corrigió:

### Listados

Todos los endpoints que devuelven colecciones están paginados y **acotados**: `page`, `limit` y
filtros, con un techo de **100 documentos por página** (`PAGINATION.MAX_LIMIT`). Un
`?limit=100000` se recorta al máximo en vez de traer la colección entera; hay tests que lo
verifican para productos, pedidos, entregas y usuarios.

Además, los repositorios usan `.lean()` (documentos planos, sin la maquinaria de Mongoose),
proyecciones explícitas (nunca `SELECT *`) y `countDocuments` en paralelo con la consulta.

### Dos problemas encontrados y corregidos

**`fs.mkdirSync` en cada carga de archivo.** Multer creaba la carpeta destino de forma
sincrónica, **bloqueando el Event Loop** en cada subida. Pasó a `fs.promises.mkdir`, que es lo
que el callback de `destination` está esperando. También se reemplazó `crypto.randomBytes` por
`crypto.randomUUID`.

**Consulta N+1 al crear un pedido.** `POST /api/orders` pedía los productos **uno por uno**: un
pedido de 5 items disparaba 5 consultas. Ahora `productRepository.getManyByIds()` los trae en
una sola con `$in` y devuelve un `Map` para buscar sin recorrer.

### Carga de archivos

Límite de **5 MB** por archivo, **un archivo** por petición y una lista cerrada de tipos MIME.
Los archivos van al disco, **nunca a MongoDB** (ahí solo viajan los metadatos), y la carpeta
está fuera del repositorio. Ver [Carga de archivos](#carga-de-archivos).

### Logs

El volumen se controla con `LOG_LEVEL`: en producción no se emiten `debug` ni `http`. Los
archivos rotan por fecha con tope de tamaño y días de retención, así que no crecen sin control.

---

## Carga de archivos

Los documentos y comprobantes se suben con **Multer** vía `multipart/form-data`. El archivo se
guarda en el sistema de archivos del servidor y en MongoDB quedan **solo sus metadatos**.

### Endpoints

| Método | Ruta | Campo del archivo | Campos extra | Qué hace |
| --- | --- | --- | --- | --- |
| POST | `/api/users/:uid/documents` | `document` | `documentType` (obligatorio) | Adjunta un documento al usuario |
| POST | `/api/orders/:oid/receipt` | `receipt` | — | Adjunta un comprobante de pago al pedido |
| POST | `/api/deliveries/:did/receipt` | `receipt` | — | Adjunta un comprobante de entrega |

### Reglas de la carga

Todas viven en `src/config/multer.config.js` y `src/constants/index.js`. Ni los routers ni los
services deciden nada de esto:

| Regla | Valor |
| --- | --- |
| Tipos aceptados | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |
| Tamaño máximo | 5 MB por archivo |
| Archivos por petición | 1 |
| Tipos de documento | `id_card`, `driver_license`, `insurance`, `tax_id`, `other` |

### Dónde se guardan

```
uploads/
├── documents/            # documentos de usuario, separados por tipo
│   ├── id_card/
│   ├── driver_license/
│   ├── insurance/
│   ├── tax_id/
│   └── other/
└── receipts/
    ├── orders/           # comprobantes de pago
    └── deliveries/       # comprobantes de entrega
```

Las subcarpetas se crean solas la primera vez que se sube un archivo de ese tipo.

**El nombre original no se conserva en disco**: dos usuarios podrían subir `dni.jpg` y pisarse,
y un nombre que viene del cliente no es de fiar. Se genera uno propio con el formato
`<timestamp>-<aleatorio>.<extension>`, y el original queda en los metadatos.

### Qué se guarda en MongoDB

**Solo metadatos, nunca el binario.** Los documentos van en `user.documents[]` y los
comprobantes en `order.receipts[]` y `delivery.receipts[]`, todos con el mismo sub-esquema
(`src/models/file.schema.js`):

```json
{
  "_id": "68f1a2b3c4d5e6f7a8b9c0d9",
  "originalName": "dni-frente.png",
  "fileName": "1754741713000-9f3a2b7c1d4e.png",
  "path": "documents/id_card/1754741713000-9f3a2b7c1d4e.png",
  "mimeType": "image/png",
  "size": 245678,
  "documentType": "id_card",
  "uploadedAt": "2026-08-09T11:15:13.713Z"
}
```

La `path` es **relativa** a la carpeta de uploads: no se filtra la estructura de directorios
del servidor.

### Qué se ignora en Git

```gitignore
uploads/*
!uploads/README.md
uploads-test/
```

La carpeta `uploads/` está en el repositorio pero solo con su `README.md`, que documenta la
estructura. **Ningún archivo subido se versiona.**

### Cómo probarlo

Subir un documento a un usuario:

```bash
curl -X POST http://localhost:8080/api/users/PEGAR_ID/documents -F "documentType=id_card" -F "document=@C:/ruta/a/dni.png"
```

Adjuntar un comprobante a un pedido:

```bash
curl -X POST http://localhost:8080/api/orders/PEGAR_ID/receipt -F "receipt=@C:/ruta/a/pago.pdf"
```

También se puede probar desde **Swagger UI** (`/api/docs`, tag **Uploads**): el botón
*Try it out* muestra un selector de archivo para el campo binario.

### Errores

Todos usan el formato centralizado del Módulo 3 y están en el diccionario de errores:

| Caso | HTTP | `error.code` |
| --- | --- | --- |
| No se envió ningún archivo | 400 | `FILE_REQUIRED` |
| Falta el `documentType` | 400 | `VALIDATION_ERROR` |
| Tipo de documento fuera del enum | 400 | `INVALID_DOCUMENT_TYPE` |
| El campo del formulario no es el esperado | 400 | `UNEXPECTED_FILE_FIELD` |
| El archivo supera los 5 MB | 413 | `FILE_TOO_LARGE` |
| Tipo de archivo no permitido | 415 | `INVALID_FILE_TYPE` |
| El usuario / pedido / entrega no existe | 404 | `USER_NOT_FOUND`, `ORDER_NOT_FOUND`, `DELIVERY_NOT_FOUND` |
| No se pudo escribir el archivo | 500 | `FILE_STORAGE_ERROR` |

Los errores propios de Multer (`LIMIT_FILE_SIZE`, `LIMIT_UNEXPECTED_FILE`) se traducen a
errores del dominio en `multer.config.js`, para que el cliente reciba siempre la misma forma de
respuesta que en el resto de la API.

### Archivos huérfanos

Multer escribe el archivo **antes** de que el service pueda validar nada. Si después resulta que
el usuario no existe o el tipo de documento es inválido, el archivo ya está en disco. Por eso
`file.service.js` envuelve la asociación: si algo falla, **borra el archivo** y recién ahí
propaga el error. Hay un test que lo verifica contando los archivos de la carpeta antes y después.

### Logging

El logger registra la carga exitosa (`info`, con entidad, nombre de archivo, tipo y tamaño), el
intento de subir un tipo no permitido (`warning`), el descarte de un archivo huérfano
(`warning`) y cualquier fallo de escritura (`error`).

---

## Testing

La suite son **178 tests funcionales** que golpean la API por HTTP, de punta a punta:
router → controller → service → repository → MongoDB.

### Herramientas

| Herramienta | Para qué |
| --- | --- |
| **Mocha** | Organiza y ejecuta los tests (`describe` / `it`) |
| **Chai** | Aserciones, con la interfaz `expect` |
| **Supertest** | Hace las peticiones HTTP contra la app de Express |
| **mongodb-memory-server** | Levanta un MongoDB en memoria para que los tests no toquen ninguna base real |
| **cross-env** | Fija `NODE_ENV=test` de forma que funcione igual en Windows, Linux y Mac |

### Cómo ejecutarlos

No hace falta tener MongoDB instalado ni corriendo:

```bash
npm test
```

La primera ejecución descarga el binario de MongoDB en memoria (una sola vez) y puede tardar
un poco más. Después, la suite completa corre en unos 4 segundos.

Para correr un solo archivo:

```bash
npx cross-env NODE_ENV=test mocha --spec test/orders.test.js
```

Para re-ejecutar automáticamente al guardar cambios:

```bash
npm run test:watch
```

Y para correr contra una base de MongoDB real en vez de la de memoria:

```bash
npm run test:db
```

### ¿Hace falta una base de datos de testing?

**No para `npm test`**: levanta MongoDB en memoria, que se crea al empezar y se destruye al
terminar. Nunca toca la base de desarrollo.

Sí para `npm run test:db`, que usa la `MONGODB_URI` de `.env.test`. Esa URI **tiene que
apuntar a una base exclusiva de tests** (por ejemplo `shipnow_test`), porque la suite borra
las colecciones después de cada test.

### Variables de entorno

El entorno de testing tiene su propio archivo. `src/config/env.config.js` elige cuál cargar
según `NODE_ENV`, que fija el script de npm:

```
NODE_ENV=test   ->  .env.test
cualquier otro  ->  .env
```

Para prepararlo:

```bash
cp .env.test.example .env.test
```

En Windows:

```bash
copy .env.test.example .env.test
```

| Variable | Valor sugerido | Nota |
| --- | --- | --- |
| `NODE_ENV` | `test` | Silencia la consola y desactiva la escritura de logs a disco |
| `PORT` | `8081` | Los tests no abren el puerto, pero la validación de entorno lo exige |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/shipnow_test` | Solo se usa con `npm run test:db` |
| `DEFAULT_PAGE_SIZE` | `10` | |
| `BCRYPT_SALT_ROUNDS` | `4` | Bajo a propósito: con 10 los tests se vuelven lentos |

`.env.test` está en el `.gitignore`; lo que se versiona es `.env.test.example`.

### Qué módulos están cubiertos

| Archivo | Tests | Cubre |
| --- | --- | --- |
| `users.test.js` | 26 | Listado, registro, login, consulta por id, cambio de rol y baja |
| `products.test.js` | 19 | Catálogo, disponibles, alta, detalle, descuento de stock, actualización y baja |
| `orders.test.js` | 28 | Creación, listado, consulta por id y transiciones de estado |
| `deliveries.test.js` | 14 | Listado, detalle, asignación de repartidor y cambio de estado |
| `mocks.test.js` | 28 | Generación sin persistir, carga en MongoDB, cantidades inválidas y limpieza |
| `production.test.js` | 27 | Health check, límites de listados, endpoints internos, entorno y Docker |
| `uploads.test.js` | 21 | Documentos de usuario, comprobantes, validaciones y limpieza de huérfanos |
| `utilities.test.js` | 14 | Logger, health, Swagger y rutas inexistentes |

### Qué se valida en cada test

No alcanza con que el endpoint "responda". Cada test comprueba **status + estructura del
body**, usando las aserciones compartidas de `test/helpers/assertions.js`:

- **Casos exitosos** — que la respuesta tenga la forma `{ status: "success", payload }`, que
  no traiga bloque `error`, y que el payload tenga las propiedades importantes: un pedido con
  sus items, `total` igual a la suma de los subtotales y cada `subtotal` igual a
  `precio × cantidad`; un usuario **sin** el campo `password`; un producto con el `status`
  coherente con su stock; una entrega con repartidor si su estado lo exige.
- **Casos de error** — que respeten el formato del Módulo 3:
  `{ status: "error", error: { code, message, details? }, timestamp, path }`, con el `code`
  exacto que corresponde, un `timestamp` que sea una fecha válida y sin bloque `payload`.

Ejemplos de errores cubiertos: datos incompletos (`VALIDATION_ERROR`), recurso inexistente
(`ORDER_NOT_FOUND`, `USER_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `DELIVERY_NOT_FOUND`), estado
inválido (`INVALID_ORDER_STATUS`, `INVALID_DELIVERY_STATUS`), permisos (`FORBIDDEN_ROLE`),
credenciales (`INVALID_CREDENTIALS`), stock insuficiente (`INSUFFICIENT_STOCK`), cantidades
inválidas en mocks (`INVALID_MOCK_COUNT`) y ruta inexistente (`ROUTE_NOT_FOUND`).

### Datos de prueba y limpieza

Ningún test depende de datos cargados a mano ni del estado que dejó otro:

- Cada test **crea lo que necesita** a través de la propia API, con los fixtures de
  `test/helpers/fixtures.js` (`createUser`, `createProduct`, `createOrder`, `generateMockData`).
  Los emails y códigos llevan un sufijo único para no chocar contra los índices.
- Un hook `afterEach` **vacía todas las colecciones** después de cada test.
- Al terminar la suite se borra la base entera y se apaga el servidor en memoria.

Esto se verificó de dos formas: corriendo cada archivo **aislado** (26 + 19 + 28 + 14 + 28 + 14
= 129, más 21 de uploads y 1 de Swagger) y corriendo la suite completa en **orden invertido**.

### Coherencia con Swagger

`utilities.test.js` recorre la especificación OpenAPI y, para cada endpoint que documenta un
`404`, comprueba contra la API que efectivamente lo devuelva con el `code` correcto. Si alguien
documenta un comportamiento que la API no tiene, el test falla.

### Por qué la app está separada del servidor

`src/app.js` construye la app de Express y `src/server.js` es el único que abre el puerto.
Gracias a eso, Supertest recibe la app directamente:

```js
const request = supertest(createApp());
```

No hay que levantar un servidor a mano ni ocuparse de cerrarlo: Supertest abre un puerto
efímero por petición y lo libera solo.

---

## Documentación con Swagger

La API se documenta con **Swagger / OpenAPI 3.0.3**, usando `swagger-jsdoc` para armar la
especificación y `swagger-ui-express` para servirla.

### Cómo acceder

Con el servidor levantado (`npm run dev`), la documentación interactiva está en:

```
http://localhost:8080/api/docs
```

Desde ahí se puede leer y **probar cada endpoint** con el botón *Try it out*. La especificación
cruda, por si querés importarla en Postman o Insomnia, está en:

```
http://localhost:8080/api/docs.json
```

### Qué está documentado

Los endpoints están agrupados por tags, uno por módulo:

| Tag | Endpoints | Qué cubre |
| --- | --- | --- |
| **Users** | 7 | Registro, login, consulta, actualización, cambio de rol y baja |
| **Products** | 7 | Catálogo, alta, actualización, descuento de stock y baja |
| **Orders** | 3 | Consulta de pedidos y avance del ciclo de vida |
| **Deliveries** | 4 | Consulta, cambio de estado y asignación de repartidor |
| **Mocks** | 9 | Generación de datos simulados y carga controlada en MongoDB |
| **Logger** | 2 | Endpoint de prueba del logger y estado de la API |

Son **26 rutas / 32 operaciones**, con método, descripción, parámetros de ruta y query, body
esperado, respuesta exitosa y todas las respuestas de error que la API realmente devuelve.

### Schemas reutilizables

En [`src/docs/components.yaml`](src/docs/components.yaml), referenciados con `$ref` desde
cada endpoint:

`User`, `UserCreateInput`, `Product`, `ProductCreateInput`, `Order`, `OrderItem`,
`ShippingAddress`, `Delivery`, `Pagination`, `SuccessResponse` y `ErrorResponse`.

También hay parámetros reutilizables (`x-user-role`, `x-user-id`, `page`, `limit`, `order`) y
respuestas de error reutilizables (`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`,
`Conflict`, `UnprocessableEntity`, `InternalError`, `InvalidMockCount`).

Los errores documentados **son los reales**: cada `code` que aparece en la documentación existe
en el diccionario de errores del Módulo 3. Están cubiertos los casos que pide la consigna —
datos inválidos, recurso no encontrado, credenciales incorrectas, error interno, cantidad
inválida en mocks y estado inválido en pedidos y entregas.

### Dónde vive la documentación

Separada del código de rutas, que es lo que pide la consigna:

| Archivo | Qué tiene |
| --- | --- |
| `src/config/swagger.config.js` | Info general, tags, servidor y opciones de Swagger UI |
| `src/docs/*.yaml` | La descripción de cada endpoint y los schemas, un archivo por módulo |
| `src/routes/docs.routes.js` | Solo monta Swagger UI. Tres líneas, cero documentación |

Los archivos de `routes/` siguen teniendo una línea por endpoint, sin un solo comentario de
Swagger mezclado con la lógica.

### Aclaraciones para probar los endpoints

**Todavía no hay autenticación** (llega en un módulo posterior), así que el rol se simula con
headers. En Swagger UI, los endpoints que lo necesitan tienen el campo `x-user-role` entre sus
parámetros: hay que escribir `admin` ahí antes de darle *Execute*.

| Header | Valores | Default |
| --- | --- | --- |
| `x-user-role` | `admin`, `user`, `courier` | `user` |
| `x-user-id` | id del usuario logueado | `null` |

**Recorrido sugerido** para probar la API desde cero:

1. `POST /mocks/generateData` con `x-user-role: admin` — genera usuarios, repartidores, productos, pedidos y entregas relacionados.
2. `GET /orders` y `GET /deliveries` — ver lo que se generó, con las relaciones resueltas.
3. `GET /users?role=courier` con rol admin — obtener el id de un repartidor.
4. `PATCH /deliveries/{did}/courier` — asignarlo a una entrega.
5. `PATCH /orders/{oid}/status` — avanzar el pedido respetando las transiciones válidas.
6. `DELETE /mocks` con rol admin — limpiar todo lo generado.

**Sobre Orders y Deliveries.** Los pedidos y las entregas se crean desde el módulo de mocks; la
API expone su consulta, el avance de estado y la asignación de repartidor. Los endpoints
documentados son exactamente esos: no hay un `POST /orders` documentado porque no existe.

---

## Logging y monitoreo

La herramienta es **Winston** (`winston` + `winston-daily-rotate-file`). Toda la configuración
vive en un único archivo, [`src/config/logger.config.js`](src/config/logger.config.js), y el
resto de la app solo hace:

```js
const { logger } = require('../config');
logger.info('Producto creado', { code: 'SN-NB-001' });
```

No queda **ningún** `console.log` en `src/`: el arranque, la conexión a Mongo, el middleware de
errores, el módulo de mocks y el seed pasaron todos al logger.

### Niveles

De más grave a menos grave. En Winston, a menor número mayor severidad: al fijar un nivel se
emite ese y **todos los más graves**.

| Nivel | Nº | Cuándo se usa en ShipNow |
| --- | --- | --- |
| `fatal` | 0 | Falla crítica: no se pudo conectar a MongoDB al arrancar, excepción no capturada, fallo del seed |
| `error` | 1 | Falla inesperada del servidor (5xx): se rompió una escritura, un bug no previsto |
| `warning` | 2 | Error esperado del negocio (4xx), cantidad inválida en mocks, producto sin stock, cambio de rol |
| `info` | 3 | Evento normal: servidor iniciado, Mongo conectado, producto creado, datos mock generados |
| `http` | 4 | Una línea por petición, con status y duración |
| `debug` | 5 | Detalle fino: stock descontado, configuración del logger |

Formato de cada línea, en consola y en archivo:

```
2026-08-09 11:15:13 [info]    Servidor ShipNow escuchando en el puerto 8080 {"entorno":"development"}
2026-08-09 11:15:13 [info]    Conexion a MongoDB establecida {"base":"shipnow"}
2026-08-09 11:15:21 [warning] PRODUCT_NOT_FOUND: El producto solicitado no existe {"metodo":"GET","status":404}
2026-08-09 11:15:29 [error]   MOCK_PERSISTENCE_ERROR: Fallo la carga de datos de prueba al insertar "products"
```

En consola los niveles van coloreados; en los archivos no, para que sean fáciles de grepear.

### Comportamiento según el entorno

Se apoya en `NODE_ENV`, la variable validada en el Módulo 1:

| Entorno | Nivel mínimo en consola | Archivos |
| --- | --- | --- |
| `development` | `debug` — se ve todo, incluidas las trazas HTTP | sí |
| `production` | `info` — sin `debug` ni `http`, para no llenar el disco de ruido | sí |
| `test` | consola silenciada | **no** se escribe nada a disco |

### Dónde se guardan los logs

En la carpeta [`logs/`](logs/), con rotación diaria:

| Archivo | Qué contiene | Rotación |
| --- | --- | --- |
| `error-YYYY-MM-DD.log` | **solo** `error` y `fatal` | 5 MB por archivo, 14 días de historial |
| `combined-YYYY-MM-DD.log` | desde `info` hacia arriba | 10 MB por archivo, 7 días de historial |

Los archivos rotados se comprimen en `.gz`. Cuando se supera el límite de días, los más viejos
se borran solos: el historial no crece sin control.

### Qué se ignora en Git

```gitignore
logs/*
!logs/README.md
*.log
*.log.gz
```

La carpeta `logs/` **sí** está en el repositorio, pero solo con su `README.md`, que documenta
qué archivo guarda qué. Todo lo que genera la aplicación queda fuera.

### Cómo probar el logger

Hay un endpoint interno que emite un log de cada nivel de una sola vez. No es una funcionalidad
del negocio: existe para verificar la configuración de un vistazo.

```bash
curl http://localhost:8080/api/logger-test
```

Devuelve qué niveles emitió, en qué entorno está y a dónde van los archivos:

```json
{
  "status": "success",
  "payload": {
    "mensaje": "Se emitio un log de cada nivel. Revisa la consola y la carpeta de logs.",
    "entorno": "development",
    "nivelesEmitidos": ["debug", "http", "info", "warning", "error", "fatal"],
    "nivelMinimoEnConsola": "debug",
    "jerarquia": { "fatal": 0, "error": 1, "warning": 2, "info": 3, "http": 4, "debug": 5 }
  }
}
```

Después de llamarlo, en la **consola** se ven los seis niveles, y en el archivo de errores
quedan **solo dos**:

```bash
type logs\error-2026-08-09.log
```

En Linux o Mac:

```bash
cat logs/error-$(date +%F).log
```

Para comprobar que un error real también queda registrado — este devuelve `404` al cliente y
un `warning` en `combined`, sin ensuciar `error.log`:

```bash
curl http://localhost:8080/api/products/64b7f1f1f1f1f1f1f1f1f1f1
```

Y para ver el comportamiento en producción, donde `debug` y `http` desaparecen de la consola:

```bash
npm start
```

---

## Manejo centralizado de errores

Ningún controller, service ni router arma una respuesta de error. El recorrido es siempre el
mismo:

```
Service detecta el problema
   └─> lanza un error de dominio (UserNotFoundError, InvalidMockCountError, …)
        └─> Controller lo deriva con next(error)      ← no lo interpreta
             └─> Middleware global normaliza y responde   ← ÚNICA salida de errores
```

La capa tiene cuatro piezas:

| Pieza | Archivo | Rol |
| --- | --- | --- |
| **Diccionario** | `errors/error.dictionary.js` | Único lugar donde un código se asocia a un status HTTP y a un mensaje |
| **Clase base** | `errors/AppError.js` | Toma el `code` y saca de ahí `status` y `message`. Nadie escribe un `404` a mano |
| **Errores del dominio** | `errors/domain.errors.js` | 27 clases que representan casos concretos del negocio |
| **Normalizador** | `errors/error.normalizer.js` | Traduce lo que no es un `AppError` (errores de Mongoose, bugs) a la misma forma |
| **Middleware global** | `middlewares/error.middleware.js` | Loguea y emite la respuesta. Es el único que llama a `failure()` |

**Por qué el service no elige el status HTTP.** Un service que hace `throw AppError.conflict(…)`
está decidiendo algo de HTTP, que es un detalle del transporte. Con el diccionario, el service
dice *qué* pasó (`new InsufficientStockError({ requested, available })`) y el `409` sale de una
tabla. Si mañana esos errores viajan por gRPC o por una cola, los services no cambian.

**Errores personalizados del dominio** (extracto):

| Clase | Código | HTTP |
| --- | --- | --- |
| `ProductNotFoundError` | `PRODUCT_NOT_FOUND` | 404 |
| `InsufficientStockError` | `INSUFFICIENT_STOCK` | 409 |
| `ProductCodeInUseError` | `PRODUCT_CODE_IN_USE` | 409 |
| `UserNotFoundError` | `USER_NOT_FOUND` | 404 |
| `EmailInUseError` | `USER_EMAIL_IN_USE` | 409 |
| `InvalidCredentialsError` | `INVALID_CREDENTIALS` | 401 |
| `LastAdminError` | `LAST_ADMIN` | 409 |
| `ForbiddenRoleError` | `FORBIDDEN_ROLE` | 403 |
| `ValidationError` | `VALIDATION_ERROR` | 400 |
| `InvalidMockCountError` | `INVALID_MOCK_COUNT` | 400 |
| `MockMissingUsersError` | `MOCK_MISSING_USERS` | 400 |
| `MockIncoherentDataError` | `MOCK_INCOHERENT_DATA` | 422 |
| `MockPersistenceError` | `MOCK_PERSISTENCE_ERROR` | 500 |

**Errores esperados vs. bugs.** Todo `AppError` nace con `isOperational: true`: es un caso que
el dominio previó. Lo que entra al middleware sin ser un `AppError` se envuelve como
`INTERNAL_ERROR` con `isOperational: false`, se loguea entero con su causa original y, en
producción, no filtra su mensaje al cliente.

**Errores de Mongoose.** Los traduce el normalizador, no los services. Un `ValidationError` de
esquema sale como `SCHEMA_VALIDATION_ERROR` (422) con la lista de campos; un `CastError` como
`INVALID_ID` (400); un índice único violado como `DUPLICATED_KEY` (409), incluida la variante
que aparece dentro de un `insertMany` masivo.

### Cómo probar el comportamiento ante casos inválidos

Todos estos devuelven la misma estructura, cambiando solo `code`, `message` y `details`:

```bash
curl -i http://localhost:8080/api/products/no-existe-este-id
```

```bash
curl -i -X POST http://localhost:8080/api/products -H "Content-Type: application/json" -H "x-user-role: admin" -d "{\"title\":\"Solo titulo\"}"
```

```bash
curl -i -X POST http://localhost:8080/api/products -H "Content-Type: application/json" -H "x-user-role: user" -d "{}"
```

```bash
curl -i "http://localhost:8080/api/products?category=naves-espaciales"
```

```bash
curl -i -X POST http://localhost:8080/api/users -H "Content-Type: application/json" -d "{\"firstName\":\"a\",\"lastName\":\"b\",\"email\":\"no-es-un-mail\",\"password\":\"123\"}"
```

```bash
curl -i http://localhost:8080/api/ruta-que-no-existe
```

| Caso | HTTP | `error.code` |
| --- | --- | --- |
| Producto inexistente o id malformado | 404 | `PRODUCT_NOT_FOUND` |
| Campos obligatorios faltantes | 400 | `VALIDATION_ERROR` |
| Alta de producto sin ser admin | 403 | `FORBIDDEN_ROLE` |
| Categoría fuera del enum | 400 | `INVALID_PRODUCT_CATEGORY` |
| Email mal formado / contraseña corta | 400 | `VALIDATION_ERROR` |
| Email ya registrado | 409 | `USER_EMAIL_IN_USE` |
| Login con contraseña incorrecta | 401 | `INVALID_CREDENTIALS` |
| Descontar más stock del disponible | 409 | `INSUFFICIENT_STOCK` |
| Degradar al último administrador | 409 | `LAST_ADMIN` |
| Ruta inexistente | 404 | `ROUTE_NOT_FOUND` |

### Casos inválidos del módulo de mocks

El módulo valida **cantidad, tipo y rango** de cada parámetro, y distingue el motivo del
rechazo en el mensaje:

```bash
curl -i "http://localhost:8080/api/mocks/users?count=-5"
```

```bash
curl -i "http://localhost:8080/api/mocks/users?count=2.5"
```

```bash
curl -i "http://localhost:8080/api/mocks/users?count=diez"
```

```bash
curl -i "http://localhost:8080/api/mocks/users?count=9999"
```

Respuesta del primero:

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_MOCK_COUNT",
    "message": "El parametro \"count\" no es una cantidad valida: no puede ser negativo",
    "details": { "field": "count", "received": -5, "min": 1, "max": 200 }
  },
  "timestamp": "2026-08-02T14:47:25.713Z",
  "path": "GET /api/mocks/users?count=-5"
}
```

| Valor enviado | Motivo en el mensaje |
| --- | --- |
| `-5` | no puede ser negativo |
| `2.5` | tiene que ser un entero, no un decimal |
| `diez` | no es un número |
| `0` | tiene que ser mayor a 0 |
| `9999` | supera el máximo permitido de 200 |
| `[5]` / `{}` / `true` | tiene que ser un número |

Y los casos de la carga en MongoDB:

```bash
curl -i -X POST http://localhost:8080/api/mocks/generateData -H "Content-Type: application/json" -H "x-user-role: admin" -d "{\"users\":-3}"
```

```bash
curl -i -X POST http://localhost:8080/api/mocks/generateData -H "Content-Type: application/json" -H "x-user-role: admin" -d "{\"users\":2,\"orders\":0,\"deliveries\":2}"
```

| Caso | HTTP | `error.code` |
| --- | --- | --- |
| Cantidad inválida (negativa, decimal, no numérica, fuera de rango) | 400 | `INVALID_MOCK_COUNT` |
| Carga sin ser admin | 403 | `FORBIDDEN_ROLE` |
| Pedidos sin usuarios con los que relacionarlos | 400 | `MOCK_MISSING_USERS` |
| Pedidos sin productos con los que armarlos | 400 | `MOCK_MISSING_PRODUCTS` |
| Entregas sin pedidos | 400 | `MOCK_MISSING_ORDERS` |
| Entregas generadas en un estado incoherente | 422 | `MOCK_INCOHERENT_DATA` |
| Falla la escritura en MongoDB | 500 | `MOCK_PERSISTENCE_ERROR` |

En el último caso el error identifica **qué entidad** falló y por qué, sin exponer el stack del
driver:

```json
{
  "status": "error",
  "error": {
    "code": "MOCK_PERSISTENCE_ERROR",
    "message": "Fallo la carga de datos de prueba al insertar \"products\"",
    "details": { "entity": "products", "reason": "E11000 duplicate key error collection: shipnow.products" }
  },
  "timestamp": "2026-08-02T14:47:25.713Z",
  "path": "POST /api/mocks/generateData"
}
```

---

## Constantes en lugar de strings mágicos

Todo el dominio usa `src/constants/index.js`, con objetos congelados con `Object.freeze`:

| Constante                            | Valores                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `USER_ROLES`                         | `ADMIN`, `USER`, `COURIER`                                                    |
| `PRODUCT_STATUS`                     | `AVAILABLE`, `OUT_OF_STOCK`, `DISCONTINUED`                                   |
| `PRODUCT_CATEGORIES`                 | `ELECTRONICS`, `CLOTHING`, `HOME`, `SPORTS`, `OTHER`                          |
| `ORDER_STATUS`                       | `PENDING`, `CONFIRMED`, `PREPARING`, `SHIPPED`, `DELIVERED`, `CANCELLED`      |
| `ORDER_PRIORITY`                     | `LOW`, `NORMAL`, `HIGH`, `URGENT`                                             |
| `DELIVERY_STATUS`                    | `PENDING_ASSIGNMENT`, `ASSIGNED`, `IN_TRANSIT`, `DELIVERED`, `FAILED`, `RETURNED` |
| `DELIVERY_STATUS_REQUIRING_COURIER`  | estados de entrega que obligan a tener repartidor asignado                    |
| `MOCK_LIMITS`                        | `DEFAULT_COUNT`, `MAX_COUNT`, `MAX_ITEMS_PER_ORDER`, `DEFAULT_PASSWORD`       |
| `HTTP_STATUS`                        | `OK`, `CREATED`, `BAD_REQUEST`, `FORBIDDEN`, `CONFLICT`…                      |
| `PAGINATION`                         | `DEFAULT_PAGE`, `MAX_LIMIT`                                                   |
| `SORT_ORDER`                         | `ASC`, `DESC`                                                                 |

El **repartidor** no es una entidad aparte: es un `User` con rol `COURIER`. Así una entrega
puede referenciarlo con la misma colección de usuarios y el rol queda validado por el mismo
`enum` que el resto.

Los `enum` de los modelos se alimentan de estos mismos objetos
(`enum: Object.values(USER_ROLES)`), así que no hay forma de que el esquema y la lógica se
desincronicen.

Los **mensajes de error** ya no viven acá: desde el Módulo 3 están en
`src/errors/error.dictionary.js`, junto con el status HTTP de cada uno. Tener el texto en un
lado y el status en otro era pedir que se desincronizaran.

> La consigna nombra el diccionario en dos rutas distintas (`src/utils/constants.js` y
> `src/constants/index.js`). La implementación real está en `src/constants/index.js`;
> `src/utils/constants.js` es un alias de una línea que la reexporta, para que ambos imports
> funcionen sin duplicar la fuente de verdad.

---

## Endpoints

Base URL: `http://localhost:8080/api`

Como la autenticación llega en un módulo posterior, el rol de quien ejecuta la request se
simula con headers. `requester.middleware.js` los traduce a `req.requester`; cuando entre
JWT/Passport solo cambia ese archivo.

| Header         | Valores               | Default |
| -------------- | --------------------- | ------- |
| `x-user-role`  | `admin` \| `user` \| `courier` | `user`  |
| `x-user-id`    | id del usuario logueado | `null` |

### Utilidades

| Método | Ruta            | Descripción                                                  |
| ------ | --------------- | ------------------------------------------------------------ |
| GET    | `/docs`         | Documentación interactiva (Swagger UI)                       |
| GET    | `/docs.json`    | Especificación OpenAPI cruda                                 |
| GET    | `/health`       | Estado de la API, entorno y uptime                           |
| GET    | `/logger-test`  | Emite un log de cada nivel para verificar la configuración   |

### Productos

| Método | Ruta                        | Permiso | Descripción                                        |
| ------ | --------------------------- | ------- | -------------------------------------------------- |
| GET    | `/products`                 | público | Listado paginado + valor total del inventario      |
| GET    | `/products/available`       | público | Solo productos con stock disponible                |
| GET    | `/products/:pid`            | público | Detalle                                            |
| POST   | `/products`                 | ADMIN   | Alta (calcula `status` según el stock)             |
| PUT    | `/products/:pid`            | ADMIN   | Actualización parcial (recalcula `status`)         |
| PATCH  | `/products/:pid/stock`      | público | Descuenta stock de forma atómica                   |
| DELETE | `/products/:pid`            | ADMIN   | Baja lógica                                        |

Query params del listado: `?page=1&limit=10&category=electronics&status=available&available=true&sortBy=price&order=asc`

### Usuarios

| Método | Ruta                  | Permiso            | Descripción                                    |
| ------ | --------------------- | ------------------ | ---------------------------------------------- |
| GET    | `/users`              | ADMIN              | Listado paginado                               |
| GET    | `/users/:uid`         | dueño o ADMIN      | Detalle                                        |
| POST   | `/users`              | público            | Registro (el rol solo lo puede fijar un ADMIN) |
| POST   | `/users/login`        | público            | Verificación de credenciales                   |
| PUT    | `/users/:uid`         | dueño o ADMIN      | Actualiza nombre / email / contraseña          |
| PATCH  | `/users/:uid/role`    | ADMIN              | Cambia el rol (protege al último admin)        |
| POST   | `/users/:uid/documents` | público          | Adjunta un documento (`multipart/form-data`)   |
| DELETE | `/users/:uid`         | ADMIN              | Baja lógica (protege al último admin)          |

### Pedidos

| Método | Ruta                    | Permiso | Descripción                                              |
| ------ | ----------------------- | ------- | -------------------------------------------------------- |
| GET    | `/orders`               | público | Listado paginado + total facturado                       |
| POST   | `/orders`               | público | Crea un pedido: valida stock, descuenta y calcula el total |
| GET    | `/orders/:oid`          | público | Detalle, con usuario e items resueltos                   |
| PATCH  | `/orders/:oid/status`   | ADMIN   | Avanza el estado respetando las transiciones permitidas  |
| POST   | `/orders/:oid/receipt`  | público | Adjunta un comprobante de pago (`multipart/form-data`)   |

Query params: `?status=pending&priority=urgent&user=<id>&page=1&limit=10&sortBy=total&order=desc`

Transiciones válidas: `pending → confirmed|cancelled`, `confirmed → preparing|cancelled`,
`preparing → shipped|cancelled`, `shipped → delivered|cancelled`. `delivered` y `cancelled` son
terminales.

### Entregas

| Método | Ruta                       | Permiso | Descripción                                       |
| ------ | -------------------------- | ------- | ------------------------------------------------- |
| GET    | `/deliveries`              | público | Listado + cuántas están sin repartidor            |
| GET    | `/deliveries/:did`         | público | Detalle, con pedido y repartidor resueltos        |
| PATCH  | `/deliveries/:did/status`  | ADMIN   | Cambia el estado                                  |
| PATCH  | `/deliveries/:did/courier` | ADMIN   | Asigna un repartidor (usuario con rol `courier`)  |
| POST   | `/deliveries/:did/receipt` | público | Adjunta un comprobante de entrega                 |

Query params: `?status=assigned&courier=<id>&unassigned=true&page=1&limit=10`

Regla de coherencia: los estados `assigned`, `in_transit`, `delivered`, `failed` y `returned`
exigen repartidor asignado. Sin uno, la API responde `400`.

### Mocks — `/api/mocks`

Router del Módulo 2. Los `GET` **solo generan y devuelven**: no escriben nada en MongoDB.
El `POST` y el `DELETE` son los únicos que tocan la base, y exigen rol `admin`.

| Método | Ruta                       | Permiso | Persiste | Descripción                                             |
| ------ | -------------------------- | ------- | -------- | ------------------------------------------------------- |
| GET    | `/mocks/users`             | público | no       | Usuarios simulados con roles válidos                    |
| GET    | `/mocks/couriers`          | público | no       | Repartidores (usuarios con rol `courier`)               |
| GET    | `/mocks/products`          | público | no       | Productos simulados                                     |
| GET    | `/mocks/orders`            | público | no       | Pedidos con estados, prioridades e items                |
| GET    | `/mocks/deliveries`        | público | no       | Entregas asociadas a pedidos y repartidores             |
| GET    | `/mocks/dataset`           | público | no       | Set completo y relacionado entre sí, de una sola vez    |
| GET    | `/mocks/summary`           | público | no       | Cuántos datos de prueba hay hoy en la base              |
| POST   | `/mocks/generateData`      | ADMIN   | **sí**   | Inserta el lote en MongoDB                              |
| DELETE | `/mocks`                   | ADMIN   | **sí**   | Borra solo lo marcado como dato de prueba               |

#### Qué datos se pueden generar

| Entidad         | Se genera con                                    | Relaciones que respeta                                              |
| --------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| **Usuarios**    | nombre, apellido, email único, rol `user`/`admin` | —                                                                   |
| **Repartidores**| igual que un usuario, pero rol `courier` fijo     | —                                                                   |
| **Productos**   | título, descripción, código único, precio, stock  | `status` derivado del stock, igual que en `ProductService`           |
| **Pedidos**     | código, items, total, estado, prioridad, dirección | `user` → un usuario existente; `items[].product` → productos existentes |
| **Entregas**    | tracking, estado, fechas, intentos                | `order` → un pedido (1 a 1); `courier` → un usuario con rol `courier` |

#### Vista previa (sin tocar la base)

Todos los `GET` aceptan `?count=N` (entre 1 y 200; por defecto 10):

```bash
curl "http://localhost:8080/api/mocks/users?count=5"
```

```bash
curl "http://localhost:8080/api/mocks/couriers?count=3"
```

```bash
curl "http://localhost:8080/api/mocks/orders?count=4"
```

```bash
curl "http://localhost:8080/api/mocks/deliveries?count=4"
```

El dataset completo acepta una cantidad por entidad y devuelve todo ya relacionado, más un
resumen de cómo quedaron las relaciones:

```bash
curl "http://localhost:8080/api/mocks/dataset?users=5&couriers=2&products=8&orders=6"
```

```json
{
  "status": "success",
  "payload": {
    "users": [ ],
    "couriers": [ ],
    "products": [ ],
    "orders": [ ],
    "deliveries": [ ],
    "relations": {
      "ordersPerUser": 1.2,
      "deliveriesWithCourier": 4,
      "deliveriesPendingAssignment": 2,
      "couriersAvailable": 2
    }
  }
}
```

Los pedidos y entregas de la vista previa llevan `_id` generados al vuelo, que **no existen
en la base**: están solo para que se vea cómo quedan armadas las relaciones.

#### Carga de datos de prueba en MongoDB

```bash
curl -X POST http://localhost:8080/api/mocks/generateData -H "Content-Type: application/json" -H "x-user-role: admin" -d "{\"users\":10,\"couriers\":4,\"products\":20,\"orders\":15,\"deliveries\":15}"
```

Todos los campos del body son opcionales; los valores por defecto son
`users: 5`, `couriers: 3`, `products: 10`, `orders: 5` y `deliveries: 5` (una por pedido).

Respuesta:

```json
{
  "status": "success",
  "payload": {
    "inserted": { "users": 10, "couriers": 4, "products": 20, "orders": 15, "deliveries": 15 },
    "credentials": {
      "note": "Todos los usuarios simulados comparten la misma contrasena",
      "password": "mock1234",
      "sampleEmail": "ana.perez.0k3fa@shipnow.dev"
    },
    "relations": { "ordersPerUser": 1.5, "deliveriesWithCourier": 11, "deliveriesPendingAssignment": 4, "couriersAvailable": 4 }
  }
}
```

Los usuarios simulados quedan con la contraseña **`mock1234`** (hasheada con bcrypt, igual
que un alta real), así que sirven para probar el login:

```bash
curl -X POST http://localhost:8080/api/users/login -H "Content-Type: application/json" -d "{\"email\":\"PEGAR_EL_sampleEmail\",\"password\":\"mock1234\"}"
```

Se pueden generar pedidos sobre datos que **ya están** en la base, sin crear usuarios ni
productos nuevos, mandando `0` en esas cantidades:

```bash
curl -X POST http://localhost:8080/api/mocks/generateData -H "Content-Type: application/json" -H "x-user-role: admin" -d "{\"users\":0,\"couriers\":0,\"products\":0,\"orders\":5,\"deliveries\":5}"
```

Si no hay usuarios o productos con los que armar esos pedidos, la carga se rechaza con `400`
**antes de escribir nada**, para no dejar la base a medio cargar.

#### Ver y limpiar los datos de prueba

Todo lo que inserta el módulo queda marcado con `isMock: true`. Eso permite contarlo:

```bash
curl http://localhost:8080/api/mocks/summary
```

Y borrarlo sin arrastrar datos reales:

```bash
curl -X DELETE http://localhost:8080/api/mocks -H "x-user-role: admin"
```

El `DELETE` borra **solo** los documentos marcados como simulados. Un usuario o un producto
cargado a mano, o por `npm run seed`, no se toca.

### Formato de respuesta

Éxito:

```json
{ "status": "success", "payload": { } }
```

Error — misma estructura para **todos** los errores de la API:

```json
{
  "status": "error",
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "El producto solicitado no existe",
    "details": { "id": "64b7f1f1f1f1f1f1f1f1f1f1" }
  },
  "timestamp": "2026-08-02T14:47:25.713Z",
  "path": "GET /api/products/64b7f1f1f1f1f1f1f1f1f1f1"
}
```

| Campo | Siempre presente | Para qué sirve |
| --- | --- | --- |
| `status` | sí | `"error"` — permite distinguir del `"success"` sin mirar el código HTTP |
| `error.code` | sí | Identificador estable del error. Es lo que debe leer un cliente, no el texto |
| `error.message` | sí | Descripción legible, en castellano |
| `error.details` | no | Contexto: campos inválidos, valor recibido, valores admitidos |
| `timestamp` | sí | Momento del error en ISO-8601, para cruzar con los logs |
| `path` | sí | Método y URL que lo provocaron |

Los mensajes de éxito nunca traen `error`, y los de error nunca traen `payload`.

### Ejemplos

Crear un producto (requiere rol admin):

```bash
curl -X POST http://localhost:8080/api/products -H "Content-Type: application/json" -H "x-user-role: admin" -d "{\"title\":\"Notebook 14\",\"description\":\"16GB RAM\",\"code\":\"SN-NB-001\",\"price\":899.99,\"stock\":12,\"category\":\"electronics\"}"
```

Listar productos disponibles ordenados por precio:

```bash
curl "http://localhost:8080/api/products/available?sortBy=price&order=asc"
```

Registrar un usuario:

```bash
curl -X POST http://localhost:8080/api/users -H "Content-Type: application/json" -d "{\"firstName\":\"Grace\",\"lastName\":\"Hopper\",\"email\":\"grace@shipnow.com\",\"password\":\"usuario1234\"}"
```

---

## Cumplimiento de los criterios de aceptación

### Módulo 8 — Performance, escalabilidad y Docker

| Criterio | Dónde se verifica |
| --- | --- |
| Los listados usan paginación, límite y filtros | Techo de 100 por página; tests que fuerzan `?limit=100000` |
| La carga de archivos tiene límites | 5 MB, 1 archivo, tipos cerrados, uploads fuera del repo |
| Sin operaciones sincrónicas que bloqueen el Event Loop | `mkdirSync` → `fs.promises.mkdir`; N+1 resuelto con `$in` |
| Variables por entorno, sin secretos en el código | `.env`, `.env.test`, `.env.docker`, con sus `.example` |
| La app valida las variables críticas y no arranca si faltan | `env.config.js` acumula errores y corta con mensaje claro |
| Health check simple que no expone información sensible | `GET /api/health`, con test que verifica que no filtre la URI |
| Criterio definido sobre los endpoints internos | Apagados en producción por defecto; documentado y configurable |
| `Dockerfile` con imagen de Node, dependencias, puerto y arranque | Build en dos etapas, `npm ci --omit=dev`, `USER node`, `HEALTHCHECK` |
| `.dockerignore` con node_modules, .env, .git, logs, uploads, coverage | Verificado por test |
| El contenedor recibe variables desde un archivo externo | `env_file: .env.docker` en Compose |
| La API queda disponible y permite probar health, Swagger y un endpoint principal | Verificado ejecutando el contenedor |

### Módulo 7 — Carga de archivos

| Criterio | Dónde se verifica |
| --- | --- |
| Multer con configuración centralizada, separada de los routers | `config/multer.config.js`; los routers solo usan los middlewares ya armados |
| Estructura de carpetas por tipo | `documents/<tipo>`, `receipts/orders`, `receipts/deliveries` |
| La carpeta de uploads está en `.gitignore` | `uploads/*` salvo su README; `uploads-test/` entera |
| Validaciones conectadas al sistema de errores | 6 códigos nuevos en el diccionario del Módulo 3 |
| Endpoint de documentos de usuario | `POST /api/users/:uid/documents`, con `documentType` |
| Endpoint de comprobantes de pedido/entrega | `POST /api/orders/:oid/receipt` y `POST /api/deliveries/:did/receipt` |
| En la base van solo metadatos | `models/file.schema.js`; hay un test que verifica las claves exactas |
| Errores específicos de archivos | `FILE_REQUIRED`, `INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `UNEXPECTED_FILE_FIELD`, `INVALID_DOCUMENT_TYPE`, `FILE_STORAGE_ERROR` |
| El logger registra los eventos relevantes | Carga exitosa, tipo no permitido, archivo huérfano descartado, fallo de escritura |
| Documentados en Swagger como `multipart/form-data` | `docs/uploads.yaml`, tag **Uploads**, con test que lo verifica |
| Tests funcionales de carga | 21 tests en `test/uploads.test.js` |

### Módulo 6 — Testing funcional

| Criterio | Dónde se verifica |
| --- | --- |
| Entorno de testing separado, con variables propias | `.env.test` (ignorado) + `.env.test.example`; `env.config.js` lo elige según `NODE_ENV` |
| Base de datos separada | MongoDB en memoria por defecto; `npm run test:db` para una base real dedicada |
| Mocha, Chai y Supertest instalados, con script de test | `devDependencies` + `npm test` |
| App separada del levantamiento del servidor | `src/app.js` exporta la app; solo `src/server.js` abre el puerto |
| Tests de los endpoints principales | Users, Products, Orders, Deliveries, Mocks, Logger y Swagger |
| Casos exitosos cubiertos | Listados, creación de pedido, generación de mocks, logger y `/api/docs` |
| Casos de error cubiertos | Datos incompletos, recurso inexistente, estado inválido, cantidades inválidas y ruta inexistente |
| Se valida status **y** estructura del body | Aserciones compartidas en `test/helpers/assertions.js` |
| Datos controlados y repetibles | Fixtures que crean todo vía API, con sufijos únicos |
| Estrategia de limpieza | `afterEach` vacía las colecciones; al final se borra la base |
| Tests independientes del orden | Verificado corriendo cada archivo aislado y la suite en orden invertido |
| Coherencia con Swagger | Los `404` documentados tienen su test contra la API real |

### Módulo 5 — Documentación con Swagger

| Criterio | Dónde se verifica |
| --- | --- |
| Swagger UI en una ruta específica | `GET /api/docs`, montado en `routes/docs.routes.js` |
| Configuración separada de la lógica de rutas | `config/swagger.config.js` + `src/docs/*.yaml`; los routers no tienen anotaciones |
| Información general: nombre, versión, descripción, servidor y propósito | Bloque `info` y `servers` de `swagger.config.js` |
| Agrupada por tags | `Users`, `Products`, `Orders`, `Deliveries`, `Mocks`, `Logger` — ningún endpoint sin tag |
| Método, ruta, descripción, params, body, respuesta y errores por endpoint | Verificado en las 32 operaciones |
| Schemas reutilizables | `User`, `Order`, `Delivery`, `OrderItem`, `ErrorResponse`, `SuccessResponse` y 5 más |
| Los errores documentados coinciden con los reales | Los 18 `code` documentados existen en el diccionario del Módulo 3 |
| Endpoints de mocks documentados | Los 9, con body, valores por defecto y errores por cantidad inválida |
| Endpoint del logger documentado como herramienta interna | `logger.yaml` lo aclara en la primera línea de la descripción |
| Lo documentado refleja la API real | Comparación automática entre las rutas del router de Express y los paths del spec, en ambas direcciones |

### Módulo 4 — Logging y monitoreo básico

| Criterio                                                          | Dónde se verifica                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Winston como logger centralizado                                     | `config/logger.config.js`; no queda ningún `console.log` en `src/`                       |
| Niveles `debug`, `http`, `info`, `warning`, `error`, `fatal`         | `LEVELS` en `logger.config.js`, con sus colores                                          |
| Comportamiento distinto según el entorno                             | `resolveConsoleLevel()` usa `NODE_ENV` validado en el Módulo 1                           |
| Integración con el middleware global de errores                      | `resolveLogLevel()`: 4xx → `warning`, 5xx → `error`, caída de base → `fatal`             |
| Registro de eventos importantes                                      | Arranque, conexión a Mongo, producto creado, mocks generados, cantidad inválida, ruta inexistente |
| Persistencia de errores en archivos                                  | `error-%DATE%.log` con `level: 'error'` (incluye `fatal`, que es más severo)             |
| Rotación de archivos                                                 | `DailyRotateFile`: por fecha, 5/10 MB por archivo, 14/7 días, comprimidos en `.gz`       |
| Los logs no se suben al repositorio                                  | `.gitignore` ignora `logs/*` salvo `logs/README.md`                                      |
| Endpoint de prueba del logger                                        | `GET /api/logger-test` emite un log de cada nivel                                        |

### Módulo 3 — Manejo profesional de errores

| Criterio                                                                     | Dónde se verifica                                                                     |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| No hay respuestas de error dispersas en rutas o controllers                    | `failure()` se invoca en un solo lugar de todo el proyecto: `error.middleware.js`         |
| Los errores se detectan en la capa que corresponde (services)                  | Los tres services lanzan errores de dominio; los controllers solo hacen `next(error)`     |
| La respuesta final sale únicamente del middleware                              | Ningún controller ni router llama a `res.status()` para un error                          |
| Estructura clara, predecible y uniforme                                        | `{ status, error: { code, message, details? }, timestamp, path }` en todos los casos      |
| Existen errores personalizados del dominio                                     | 27 clases en `errors/domain.errors.js`, todas heredando de `AppError`                     |
| Diccionario de errores                                                         | `errors/error.dictionary.js`: 31 códigos, cada uno con su status HTTP y mensaje           |
| Middleware global que transforma los errores en respuestas HTTP                | `errors/error.normalizer.js` + `middlewares/error.middleware.js`                          |
| El módulo de mocks valida cantidad inválida y valores negativos                | `#normalizeCount` distingue negativo, decimal, cero, no numérico y fuera de rango         |
| El módulo de mocks responde de forma controlada ante fallas de MongoDB         | `#persist()` envuelve cada escritura y lanza `MockPersistenceError` con la entidad afectada |

### Módulo 2 — Mocking y carga de datos

| Criterio                                                                        | Dónde se verifica                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| La lógica de mocking respeta las capas y no queda en los archivos de rutas       | `mock.routes.js` son 9 líneas de `path → controller`; la lógica está en `mock.service.js` |
| Existe un router específico bajo `/api/mocks`                                    | `src/routes/mock.routes.js`, montado en `src/routes/index.js`                        |
| Endpoint(s) que devuelven datos simulados sin guardarlos                         | Los 6 `GET` de `/api/mocks` (verificado: `/mocks/summary` sigue en cero después)      |
| Endpoint que inserta registros de prueba de forma controlada                     | `POST /api/mocks/generateData`: solo ADMIN, con tope de 200 por entidad y preflight   |
| Usuarios con roles válidos                                                       | `generateUser` toma el rol de `USER_ROLES`; los repartidores usan `USER_ROLES.COURIER` |
| Pedidos con estados y prioridades permitidos                                     | `generateOrder` elige de `ORDER_STATUS` y `ORDER_PRIORITY`                            |
| Entregas asociadas a pedidos y, cuando corresponde, a repartidores               | `generateDeliveries` es 1 a 1 contra pedidos; el `courier` se asigna según el estado  |
| Relación pedido ↔ usuario                                                        | `generateOrder` recibe el usuario; nunca genera un pedido huérfano                    |
| Relación entrega ↔ pedido                                                        | Índice `unique` en `order` dentro de `delivery.model.js`                              |
| Repartidor con rol coherente                                                     | Solo se asignan usuarios generados con `USER_ROLES.COURIER`                           |
| Constantes en lugar de strings sueltos                                           | Ningún `.mock.js` escribe un estado, rol o prioridad a mano                            |
| Datos simulados con estructura similar a los modelos reales                      | Se insertan con los modelos reales: si no validaran contra el esquema, fallarían       |

### Módulo 1 — Arquitectura por capas

| Criterio                                                              | Dónde se verifica                                                                 |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Carpetas `controllers/`, `services/`, `repositories/`, `models/`, `config/` | Ver estructura del proyecto                                                  |
| Controller → Service → Repository; el Controller nunca importa Mongoose | `src/controllers/*` solo importan su service, `apiResponse` y `constants`         |
| `.env` fuera del repo + `.env.example` presente                        | `.gitignore` incluye `.env`; `.env.example` está versionado                       |
| Falta una variable crítica → error descriptivo y la app no arranca     | `src/config/env.config.js` acumula errores y hace `throw`                         |
| Roles vía objeto de constantes                                         | `USER_ROLES` en `src/constants/index.js`, usado en modelo, service y middleware    |
| `routes/` mínimos                                                      | `src/routes/product.routes.js` y `user.routes.js`: solo path → método del controller |
| Repository no es "pasamanos"                                           | Filtro base, proyecciones, paginación, `adjustStock` atómico, validación de id     |
| Sin lógica de negocio en el Repository                                 | Permisos, cálculos y estados derivados están en los services                       |
| Sin `process.env` fuera de config                                      | `src/config/env.config.js` es el único archivo que lo lee                          |
| Modelos solo con esquema                                               | `src/models/*.js` no tienen hooks ni lógica de controlador                          |

---

## Autor

Gabriela Valenzuela — CoderHouse, Programación Backend III.
