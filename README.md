# ShipNow API — Arquitectura por capas, mocking y manejo centralizado de errores

Pre-entregas **Módulo 1**, **Módulo 2** y **Módulo 3** — *Programación Backend III: Testing y Escalabilidad* (CoderHouse).

API de ShipNow refactorizada desde un modelo monolítico a una arquitectura por capas
**Controller → Service → Repository**, con configuración de entorno validada al arranque,
un diccionario centralizado de constantes del dominio, un módulo de mocking que genera
usuarios, repartidores, pedidos y entregas de prueba, y una capa común de errores que hace
que toda la API falle siempre de la misma forma.

- **Módulo 1** — arquitectura por capas y configuración de entorno.
- **Módulo 2** — router `/api/mocks` con generación de datos simulados y carga controlada en MongoDB.
- **Módulo 3** — capa centralizada de manejo de errores: errores personalizados, diccionario y middleware global.

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

Verificar que responde:

```bash
curl http://localhost:8080/api/health
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
│   └── health.controller.js
├── services/
│   ├── product.service.js
│   ├── user.service.js
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
│   └── delivery.model.js
├── routes/
│   ├── index.js
│   ├── product.routes.js  # solo path -> método del controller
│   ├── user.routes.js
│   └── mock.routes.js
├── middlewares/
│   ├── requester.middleware.js  # deja quién ejecuta la request en req.requester
│   └── error.middleware.js      # manejo centralizado de errores
├── utils/
│   ├── apiResponse.js     # formato único de respuesta (éxito y error)
│   └── constants.js       # alias que reexporta src/constants
├── scripts/
│   └── seed.js
├── app.js                 # arma la app Express (no abre puerto)
└── server.js              # valida config -> conecta DB -> escucha
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
| `x-user-role`  | `admin` \| `user`     | `user`  |
| `x-user-id`    | id del usuario logueado | `null` |

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
| DELETE | `/users/:uid`         | ADMIN              | Baja lógica (protege al último admin)          |

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
