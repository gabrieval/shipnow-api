/**
 * MockService - orquestador del modulo de mocking.
 *
 * Es el cerebro del modulo: valida las cantidades pedidas, arma las relaciones
 * entre entidades, aplica las reglas de negocio sobre los datos generados
 * (totales, hasheo de contrasenas, marca `isMock`) y decide quien puede
 * persistir o borrar. Los generadores de `src/mocks/` solo inventan datos y los
 * repositories solo guardan: ninguna de las dos capas decide nada de esto.
 */
const bcrypt = require('bcrypt');

const userRepository = require('../repositories/user.repository');
const productRepository = require('../repositories/product.repository');
const orderRepository = require('../repositories/order.repository');
const deliveryRepository = require('../repositories/delivery.repository');

const {
  generateUsers,
  generateCouriers,
  generateProducts,
  generateOrders,
  generateDeliveries,
} = require('../mocks');

const {
  ForbiddenRoleError,
  InvalidMockCountError,
  MockMissingUsersError,
  MockMissingProductsError,
  MockMissingOrdersError,
  MockIncoherentDataError,
  MockPersistenceError,
} = require('../errors');
const { USER_ROLES, MOCK_LIMITS, DELIVERY_STATUS_REQUIRING_COURIER } = require('../constants');
const { config, logger } = require('../config');

class MockService {
  constructor({
    users = userRepository,
    products = productRepository,
    orders = orderRepository,
    deliveries = deliveryRepository,
  } = {}) {
    this.userRepository = users;
    this.productRepository = products;
    this.orderRepository = orders;
    this.deliveryRepository = deliveries;
  }

  // --- Helpers ------------------------------------------------------------

  /**
   * Normaliza y valida una cantidad pedida por el cliente.
   *
   * Distingue el motivo del rechazo (no numerico, negativo, decimal, cero,
   * fuera de rango) para que el error explique QUE esta mal y no solo que algo
   * lo esta. Los valores llegan como string desde la query o crudos del body.
   *
   * @param {*} value valor crudo
   * @param {{fallback?: number, allowZero?: boolean, label?: string}} [options]
   */
  #normalizeCount(value, { fallback = MOCK_LIMITS.DEFAULT_COUNT, allowZero = false, label = 'count' } = {}) {
    if (value === undefined || value === null || value === '') return fallback;

    const min = allowZero ? 0 : 1;
    const fail = (reason, received = value) => {
      // Se deja rastro del parametro rechazado: es el error mas comun de este modulo.
      logger.warning('Cantidad invalida enviada al modulo de mocks', { campo: label, recibido: received, motivo: reason });
      throw new InvalidMockCountError({ field: label, received, min, max: MOCK_LIMITS.MAX_COUNT, reason });
    };

    if (typeof value === 'boolean' || Array.isArray(value) || typeof value === 'object') {
      fail('tiene que ser un numero');
    }

    const parsed = Number(value);

    if (Number.isNaN(parsed)) fail('no es un numero');
    if (!Number.isFinite(parsed)) fail('no es un numero finito');
    if (!Number.isInteger(parsed)) fail('tiene que ser un entero, no un decimal', parsed);
    if (parsed < 0) fail('no puede ser negativo', parsed);
    if (parsed === 0 && !allowZero) fail('tiene que ser mayor a 0', parsed);
    if (parsed > MOCK_LIMITS.MAX_COUNT) fail(`supera el maximo permitido de ${MOCK_LIMITS.MAX_COUNT}`, parsed);

    return parsed;
  }

  /**
   * Envuelve una escritura masiva para que un fallo de MongoDB (indice unico,
   * conexion caida, documento que no valida) salga como un error del dominio y
   * no como un error crudo del driver.
   */
  async #persist(entity, operation) {
    try {
      return await operation();
    } catch (cause) {
      logger.error('Fallo la escritura de datos de prueba en MongoDB', { entidad: entity, motivo: cause.message });
      throw new MockPersistenceError({ entity, cause });
    }
  }

  /** Solo un ADMIN puede escribir o borrar datos de prueba en la base. */
  #assertCanPersist(requesterRole) {
    if (requesterRole !== USER_ROLES.ADMIN) {
      throw new ForbiddenRoleError({ requiredRole: USER_ROLES.ADMIN, receivedRole: requesterRole });
    }
  }

  /**
   * Regla de negocio: el total del pedido es la suma de sus subtotales.
   * Se aplica siempre sobre lo que devuelve el generador, para que ningun pedido
   * simulado quede con un total inventado.
   */
  #applyOrderTotals(orders) {
    return orders.map((order) => ({
      ...order,
      total: Number(order.items.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)),
    }));
  }

  /** Quita la contrasena: la vista previa expone lo mismo que la API real devuelve. */
  #stripPassword(users) {
    return users.map(({ password, ...rest }) => rest);
  }

  /** Marca un lote como dato de prueba para poder limpiarlo despues. */
  #markAsMock(documents) {
    return documents.map((doc) => ({ ...doc, isMock: true }));
  }

  // --- Vista previa (no toca la base) -------------------------------------

  /** Usuarios simulados con roles validos (admin/user), sin persistir. */
  previewUsers(count) {
    const total = this.#normalizeCount(count, { label: 'count' });
    return this.#stripPassword(generateUsers(total));
  }

  /** Repartidores simulados: usuarios con rol COURIER, sin persistir. */
  previewCouriers(count) {
    const total = this.#normalizeCount(count, { label: 'count' });
    return this.#stripPassword(generateCouriers(total));
  }

  /** Productos simulados, sin persistir. */
  previewProducts(count) {
    return generateProducts(this.#normalizeCount(count, { label: 'count' }));
  }

  /**
   * Pedidos simulados, sin persistir. Como un pedido no existe sin usuario ni
   * productos, se generan usuarios y productos efimeros (con ids nuevos que no
   * estan en la base) para poder sostener la relacion.
   */
  previewOrders(count) {
    const total = this.#normalizeCount(count, { label: 'count' });

    const users = this.#withEphemeralIds(generateUsers(Math.max(Math.ceil(total / 2), 1)), this.userRepository);
    const products = this.#withEphemeralIds(generateProducts(MOCK_LIMITS.MAX_ITEMS_PER_ORDER * 2), this.productRepository);

    return this.#applyOrderTotals(generateOrders(total, { users, products }));
  }

  /**
   * Entregas simuladas, sin persistir. Se apoyan en pedidos y repartidores
   * efimeros para que la relacion entrega -> pedido -> repartidor sea coherente.
   */
  previewDeliveries(count) {
    const total = this.#normalizeCount(count, { label: 'count' });

    const orders = this.#withEphemeralIds(this.previewOrders(total), this.orderRepository);
    const couriers = this.#withEphemeralIds(generateCouriers(Math.max(Math.ceil(total / 3), 1)), this.userRepository);

    return generateDeliveries({ orders, couriers });
  }

  /**
   * Dataset completo y relacionado entre si, sin persistir. Sirve para ver de un
   * vistazo como quedan las relaciones antes de escribir nada en la base.
   */
  previewDataset({ users, couriers, products, orders } = {}) {
    const usersCount = this.#normalizeCount(users, { fallback: 5, allowZero: true, label: 'users' });
    const couriersCount = this.#normalizeCount(couriers, { fallback: 3, allowZero: true, label: 'couriers' });
    const productsCount = this.#normalizeCount(products, { fallback: 10, allowZero: true, label: 'products' });
    const ordersCount = this.#normalizeCount(orders, { fallback: 5, allowZero: true, label: 'orders' });

    const generatedUsers = this.#withEphemeralIds(generateUsers(usersCount, { role: USER_ROLES.USER }), this.userRepository);
    const generatedCouriers = this.#withEphemeralIds(generateCouriers(couriersCount), this.userRepository);
    const generatedProducts = this.#withEphemeralIds(generateProducts(productsCount), this.productRepository);

    let generatedOrders = [];
    let generatedDeliveries = [];

    // Un pedido sin usuario o sin productos no tiene sentido: se omite en vez de
    // devolver datos rotos.
    if (ordersCount > 0 && generatedUsers.length > 0 && generatedProducts.length > 0) {
      generatedOrders = this.#withEphemeralIds(
        this.#applyOrderTotals(generateOrders(ordersCount, { users: generatedUsers, products: generatedProducts })),
        this.orderRepository
      );
      generatedDeliveries = generateDeliveries({ orders: generatedOrders, couriers: generatedCouriers });
    }

    return {
      users: this.#stripPassword(generatedUsers),
      couriers: this.#stripPassword(generatedCouriers),
      products: generatedProducts,
      orders: generatedOrders,
      deliveries: generatedDeliveries,
      relations: this.#describeRelations({
        users: generatedUsers,
        couriers: generatedCouriers,
        orders: generatedOrders,
        deliveries: generatedDeliveries,
      }),
    };
  }

  /**
   * Asigna ids a documentos que todavia no se guardaron, para poder relacionarlos
   * en la vista previa. El id lo fabrica el repository (es un detalle de Mongo).
   */
  #withEphemeralIds(documents, repository) {
    return documents.map((doc) => ({ _id: repository.newId(), ...doc }));
  }

  /** Resumen legible de como quedaron armadas las relaciones del lote. */
  #describeRelations({ users, couriers, orders, deliveries }) {
    const assigned = deliveries.filter((delivery) => delivery.courier !== null).length;

    return {
      ordersPerUser: users.length > 0 ? Number((orders.length / users.length).toFixed(2)) : 0,
      deliveriesWithCourier: assigned,
      deliveriesPendingAssignment: deliveries.length - assigned,
      couriersAvailable: couriers.length,
    };
  }

  // --- Persistencia controlada --------------------------------------------

  /**
   * Genera e inserta un lote relacionado en MongoDB.
   *
   * Reglas de la carga:
   *  - Solo ADMIN.
   *  - Todo lo insertado queda marcado con `isMock: true` para poder borrarlo
   *    despues sin tocar datos reales.
   *  - Si se piden pedidos pero no usuarios/productos nuevos, se reutilizan los
   *    que ya estan en la base; si tampoco hay, se corta con un error claro.
   *  - Las entregas se crean 1 a 1 contra los pedidos del mismo lote.
   *
   * @param {object} payload cantidades pedidas
   * @param {string} requesterRole rol de quien ejecuta la carga
   */
  async persistDataset(payload = {}, requesterRole) {
    this.#assertCanPersist(requesterRole);

    const usersCount = this.#normalizeCount(payload.users, { fallback: 5, allowZero: true, label: 'users' });
    const couriersCount = this.#normalizeCount(payload.couriers, { fallback: 3, allowZero: true, label: 'couriers' });
    const productsCount = this.#normalizeCount(payload.products, { fallback: 10, allowZero: true, label: 'products' });
    const ordersCount = this.#normalizeCount(payload.orders, { fallback: 5, allowZero: true, label: 'orders' });
    const deliveriesCount = this.#normalizeCount(payload.deliveries, {
      fallback: ordersCount,
      allowZero: true,
      label: 'deliveries',
    });

    // 0. Preflight: se comprueba que el lote sea armable ANTES de escribir nada.
    //    Sin esto, una carga que despues falla deja usuarios y productos sueltos
    //    en la base (insercion parcial).
    const { fallbackUsers, fallbackProducts } = await this.#preflight({
      usersCount,
      productsCount,
      ordersCount,
      deliveriesCount,
    });

    // 1. Usuarios y repartidores. Una sola pasada de bcrypt para todo el lote:
    //    son datos de prueba y todos comparten la misma contrasena conocida.
    const hashedPassword = await bcrypt.hash(MOCK_LIMITS.DEFAULT_PASSWORD, config.saltRounds);

    const usersToInsert = this.#markAsMock(
      generateUsers(usersCount, { role: USER_ROLES.USER }).map((user) => ({ ...user, password: hashedPassword }))
    );
    const couriersToInsert = this.#markAsMock(
      generateCouriers(couriersCount).map((courier) => ({ ...courier, password: hashedPassword }))
    );

    const insertedUsers = await this.#persist('users', () => this.userRepository.createMany(usersToInsert));
    const insertedCouriers = await this.#persist('couriers', () => this.userRepository.createMany(couriersToInsert));

    // 2. Productos.
    const insertedProducts = await this.#persist('products', () =>
      this.productRepository.createMany(this.#markAsMock(generateProducts(productsCount)))
    );

    // 3. Pedidos: se apoyan en los usuarios/productos recien creados o, si no se
    //    pidieron, en los que ya estaban en la base (resueltos en el preflight).
    let insertedOrders = [];
    if (ordersCount > 0) {
      const availableUsers = insertedUsers.length > 0 ? insertedUsers : fallbackUsers;
      const availableProducts = insertedProducts.length > 0 ? insertedProducts : fallbackProducts;

      const orders = this.#applyOrderTotals(
        generateOrders(ordersCount, { users: availableUsers, products: availableProducts })
      );
      insertedOrders = await this.#persist('orders', () => this.orderRepository.createMany(this.#markAsMock(orders)));
    }

    // 4. Entregas: una por pedido, hasta el maximo pedido por el cliente.
    let insertedDeliveries = [];
    if (deliveriesCount > 0) {
      const targetOrders = insertedOrders.slice(0, deliveriesCount);
      const availableCouriers = insertedCouriers.length > 0 ? insertedCouriers : await this.#fetchExistingCouriers();

      const deliveries = generateDeliveries({ orders: targetOrders, couriers: availableCouriers });
      this.#assertDeliveriesAreCoherent(deliveries);

      insertedDeliveries = await this.#persist('deliveries', () =>
        this.deliveryRepository.createMany(this.#markAsMock(deliveries))
      );
    }

    const inserted = {
      users: insertedUsers.length,
      couriers: insertedCouriers.length,
      products: insertedProducts.length,
      orders: insertedOrders.length,
      deliveries: insertedDeliveries.length,
    };

    logger.info('Datos de prueba generados y cargados en MongoDB', inserted);

    return {
      inserted,
      credentials: {
        note: 'Todos los usuarios simulados comparten la misma contrasena',
        password: MOCK_LIMITS.DEFAULT_PASSWORD,
        sampleEmail: insertedUsers[0]?.email ?? insertedCouriers[0]?.email ?? null,
      },
      relations: this.#describeRelations({
        users: insertedUsers,
        couriers: insertedCouriers,
        orders: insertedOrders,
        deliveries: insertedDeliveries,
      }),
    };
  }

  /**
   * Comprueba que el lote pedido se pueda armar entero antes de tocar la base y
   * devuelve los datos existentes que haga falta reutilizar.
   *
   * Un pedido necesita usuarios y productos; una entrega necesita pedidos. Si algo
   * de eso no se va a poder cumplir, conviene cortar aca: si el error saltara mas
   * adelante, la carga ya habria dejado a medias los usuarios y productos escritos.
   */
  async #preflight({ usersCount, productsCount, ordersCount, deliveriesCount }) {
    let fallbackUsers = [];
    let fallbackProducts = [];

    if (deliveriesCount > 0 && ordersCount === 0) {
      throw new MockMissingOrdersError();
    }

    if (ordersCount > 0) {
      if (usersCount === 0) {
        fallbackUsers = await this.#fetchExistingUsers();
        if (fallbackUsers.length === 0) throw new MockMissingUsersError();
      }

      if (productsCount === 0) {
        fallbackProducts = await this.#fetchExistingProducts();
        if (fallbackProducts.length === 0) throw new MockMissingProductsError();
      }
    }

    return { fallbackUsers, fallbackProducts };
  }

  /**
   * Ultima red de seguridad antes de escribir: ninguna entrega puede quedar en un
   * estado que exija repartidor sin tenerlo asignado.
   */
  #assertDeliveriesAreCoherent(deliveries) {
    const broken = deliveries.filter(
      (delivery) => DELIVERY_STATUS_REQUIRING_COURIER.includes(delivery.status) && !delivery.courier
    );

    if (broken.length > 0) {
      throw new MockIncoherentDataError({
        rule: 'Toda entrega en un estado que exige repartidor debe tener uno asignado',
        affected: broken.length,
        statuses: [...new Set(broken.map((delivery) => delivery.status))],
      });
    }
  }

  /** Usuarios ya existentes en la base, para relacionar pedidos sin crear usuarios nuevos. */
  async #fetchExistingUsers() {
    const { docs } = await this.userRepository.getAll({
      filter: { role: USER_ROLES.USER },
      limit: MOCK_LIMITS.MAX_COUNT,
    });
    return docs;
  }

  async #fetchExistingCouriers() {
    const { docs } = await this.userRepository.getAll({
      filter: { role: USER_ROLES.COURIER },
      limit: MOCK_LIMITS.MAX_COUNT,
    });
    return docs;
  }

  async #fetchExistingProducts() {
    const { docs } = await this.productRepository.getAll({ limit: MOCK_LIMITS.MAX_COUNT });
    return docs;
  }

  // --- Inspeccion y limpieza ----------------------------------------------

  /** Cuantos documentos de prueba hay hoy en la base, por entidad. */
  async getSummary() {
    const [users, couriers, products, orders, deliveries] = await Promise.all([
      this.userRepository.countBy({ isMock: true, role: USER_ROLES.USER }),
      this.userRepository.countBy({ isMock: true, role: USER_ROLES.COURIER }),
      this.productRepository.countBy({ isMock: true }),
      this.orderRepository.countBy({ isMock: true }),
      this.deliveryRepository.countBy({ isMock: true }),
    ]);

    return { users, couriers, products, orders, deliveries };
  }

  /**
   * Borra unicamente lo marcado como `isMock`. Los datos reales quedan intactos:
   * esa es la contracara de marcar todo lo generado.
   */
  async clearMocks(requesterRole) {
    this.#assertCanPersist(requesterRole);

    // Orden inverso al de creacion, para no dejar entregas apuntando a pedidos borrados.
    logger.info('Iniciando limpieza de datos de prueba');

    const deliveries = await this.#persist('deliveries', () => this.deliveryRepository.deleteMocks());
    const orders = await this.#persist('orders', () => this.orderRepository.deleteMocks());
    const products = await this.#persist('products', () => this.productRepository.deleteMocks());
    const users = await this.#persist('users', () => this.userRepository.deleteMocks());

    const deleted = { deliveries, orders, products, users };
    logger.info('Datos de prueba eliminados', deleted);

    return { deleted };
  }
}

module.exports = new MockService();
module.exports.MockService = MockService;
