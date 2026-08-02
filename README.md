# ShipNow API — Estructura profesional por capas + módulo de mocking

Pre-entregas **Módulo 1** y **Módulo 2** — *Programación Backend III: Testing y Escalabilidad* (CoderHouse).

API de ShipNow refactorizada desde un modelo monolítico a una arquitectura por capas
**Controller → Service → Repository**, con configuración de entorno validada al arranque,
un diccionario centralizado de constantes del dominio y un módulo de mocking que genera
usuarios, repartidores, pedidos y entregas de prueba respetando esas mismas capas.

- **Módulo 1** — arquitectura por capas y configuración de entorno.
- **Módulo 2** — router `/api/mocks` con generación de datos simulados y carga controlada en MongoDB.

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
├── controllers/
│   ├── product.controller.js
│   ├── user.controller.js
│   └── mock.controller.js
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
│   ├── AppError.js        # error de dominio con status HTTP
│   ├── apiResponse.js     # formato único de respuesta
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
                    constants / AppError / mocks
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
| `ERROR_MESSAGES`                     | mensajes reutilizables del dominio                                            |
| `PAGINATION`                         | `DEFAULT_PAGE`, `MAX_LIMIT`                                                   |
| `SORT_ORDER`                         | `ASC`, `DESC`                                                                 |

El **repartidor** no es una entidad aparte: es un `User` con rol `COURIER`. Así una entrega
puede referenciarlo con la misma colección de usuarios y el rol queda validado por el mismo
`enum` que el resto.

Los `enum` de los modelos se alimentan de estos mismos objetos
(`enum: Object.values(USER_ROLES)`), así que no hay forma de que el esquema y la lógica se
desincronicen.

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

Error:

```json
{ "status": "error", "message": "El producto solicitado no existe" }
```

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
