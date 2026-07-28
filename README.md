# ShipNow API — Estructura profesional por capas

Pre-entrega Módulo 1 — **Programación Backend III: Testing y Escalabilidad** (CoderHouse).

API de ShipNow refactorizada desde un modelo monolítico a una arquitectura por capas
**Controller → Service → Repository**, con configuración de entorno validada al arranque
y un diccionario centralizado de constantes del dominio.

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
│   └── index.js           # USER_ROLES, PRODUCT_STATUS, HTTP_STATUS... (Object.freeze)
├── controllers/
│   ├── product.controller.js
│   └── user.controller.js
├── services/
│   ├── product.service.js
│   └── user.service.js
├── repositories/
│   ├── product.repository.js
│   └── user.repository.js
├── models/
│   ├── product.model.js   # solo esquema
│   └── user.model.js      # solo esquema
├── routes/
│   ├── index.js
│   ├── product.routes.js  # solo path -> método del controller
│   └── user.routes.js
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
                       constants / AppError
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

## Constantes en lugar de strings mágicos

Todo el dominio usa `src/constants/index.js`, con objetos congelados con `Object.freeze`:

| Constante             | Valores                                                  |
| --------------------- | -------------------------------------------------------- |
| `USER_ROLES`          | `ADMIN`, `USER`                                          |
| `PRODUCT_STATUS`      | `AVAILABLE`, `OUT_OF_STOCK`, `DISCONTINUED`              |
| `PRODUCT_CATEGORIES`  | `ELECTRONICS`, `CLOTHING`, `HOME`, `SPORTS`, `OTHER`     |
| `HTTP_STATUS`         | `OK`, `CREATED`, `BAD_REQUEST`, `FORBIDDEN`, `CONFLICT`… |
| `ERROR_MESSAGES`      | mensajes reutilizables del dominio                       |
| `PAGINATION`          | `DEFAULT_PAGE`, `MAX_LIMIT`                              |
| `SORT_ORDER`          | `ASC`, `DESC`                                            |

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
