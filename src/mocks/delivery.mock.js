/**
 * Generador de entregas simuladas.
 *
 * Es el generador con mas reglas de coherencia, porque una entrega cruza tres
 * cosas: el pedido al que pertenece, el repartidor asignado y su propio estado.
 * Reglas que se respetan aca:
 *   - El estado de la entrega es compatible con el estado del pedido.
 *   - Si el estado exige repartidor, hay repartidor; si no, `courier` queda null.
 *   - `assignedAt` solo existe si hay repartidor y `deliveredAt` solo si se entrego.
 */
const { faker } = require('@faker-js/faker');
const {
  ORDER_STATUS,
  DELIVERY_STATUS,
  DELIVERY_STATUS_REQUIRING_COURIER,
} = require('../constants');

/**
 * Estados de entrega plausibles para cada estado de pedido.
 * Evita combinaciones imposibles como "pedido pendiente / entrega entregada".
 */
const STATUS_BY_ORDER_STATUS = Object.freeze({
  [ORDER_STATUS.PENDING]: [DELIVERY_STATUS.PENDING_ASSIGNMENT],
  [ORDER_STATUS.CONFIRMED]: [DELIVERY_STATUS.PENDING_ASSIGNMENT, DELIVERY_STATUS.ASSIGNED],
  [ORDER_STATUS.PREPARING]: [DELIVERY_STATUS.ASSIGNED],
  [ORDER_STATUS.SHIPPED]: [DELIVERY_STATUS.IN_TRANSIT, DELIVERY_STATUS.FAILED],
  [ORDER_STATUS.DELIVERED]: [DELIVERY_STATUS.DELIVERED],
  [ORDER_STATUS.CANCELLED]: [DELIVERY_STATUS.PENDING_ASSIGNMENT, DELIVERY_STATUS.RETURNED],
});

/**
 * @param {object} params
 * @param {object} params.order pedido al que pertenece la entrega (con `_id` y `status`)
 * @param {object[]} params.couriers repartidores disponibles (usuarios con rol COURIER)
 * @param {number} [params.index]
 */
function generateDelivery({ order, couriers = [], index = 0 }) {
  const candidates = STATUS_BY_ORDER_STATUS[order.status] ?? [DELIVERY_STATUS.PENDING_ASSIGNMENT];
  let status = faker.helpers.arrayElement(candidates);

  const needsCourier = DELIVERY_STATUS_REQUIRING_COURIER.includes(status);

  // Sin repartidores disponibles no se puede sostener un estado que exija uno:
  // se degrada a "pendiente de asignacion" antes que generar un dato incoherente.
  if (needsCourier && couriers.length === 0) {
    status = DELIVERY_STATUS.PENDING_ASSIGNMENT;
  }

  const courier =
    DELIVERY_STATUS_REQUIRING_COURIER.includes(status) && couriers.length > 0
      ? faker.helpers.arrayElement(couriers)._id
      : null;

  const assignedAt = courier ? faker.date.recent({ days: 10 }) : null;
  const deliveredAt =
    status === DELIVERY_STATUS.DELIVERED ? faker.date.between({ from: assignedAt, to: new Date() }) : null;

  return {
    trackingCode: `TRK-${String(index).padStart(4, '0')}-${faker.string.alphanumeric(6).toUpperCase()}`,
    order: order._id,
    courier,
    status,
    estimatedDate: faker.date.soon({ days: 14 }),
    assignedAt,
    deliveredAt,
    // Solo una entrega fallida acumula reintentos.
    attempts: status === DELIVERY_STATUS.FAILED ? faker.number.int({ min: 1, max: 3 }) : status === DELIVERY_STATUS.DELIVERED ? 1 : 0,
  };
}

/**
 * Genera una entrega por pedido. La relacion entrega <-> pedido es 1 a 1, asi que
 * la cantidad la manda la lista de pedidos, no un `count` arbitrario.
 * @param {{orders: object[], couriers: object[]}} params
 */
function generateDeliveries({ orders, couriers = [] }) {
  return orders.map((order, index) => generateDelivery({ order, couriers, index }));
}

module.exports = { generateDelivery, generateDeliveries, STATUS_BY_ORDER_STATUS };
