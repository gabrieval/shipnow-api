/**
 * MockController - puerta de entrada HTTP del modulo de mocking.
 *
 * Igual que el resto de los controllers: lee `req`, llama al service y elige el
 * status code. No genera ni un solo dato simulado por su cuenta.
 */
const mockService = require('../services/mock.service');
const { success } = require('../utils/apiResponse');
const { HTTP_STATUS } = require('../constants');

class MockController {
  constructor(service = mockService) {
    this.service = service;
    this.getUsers = this.getUsers.bind(this);
    this.getCouriers = this.getCouriers.bind(this);
    this.getProducts = this.getProducts.bind(this);
    this.getOrders = this.getOrders.bind(this);
    this.getDeliveries = this.getDeliveries.bind(this);
    this.getDataset = this.getDataset.bind(this);
    this.generateData = this.generateData.bind(this);
    this.getSummary = this.getSummary.bind(this);
    this.clear = this.clear.bind(this);
  }

  // --- Vista previa: generan y devuelven, no guardan ----------------------

  async getUsers(req, res, next) {
    try {
      const users = await this.service.previewUsers(req.query.count);
      return success(res, { count: users.length, users });
    } catch (error) {
      return next(error);
    }
  }

  async getCouriers(req, res, next) {
    try {
      const couriers = await this.service.previewCouriers(req.query.count);
      return success(res, { count: couriers.length, couriers });
    } catch (error) {
      return next(error);
    }
  }

  async getProducts(req, res, next) {
    try {
      const products = await this.service.previewProducts(req.query.count);
      return success(res, { count: products.length, products });
    } catch (error) {
      return next(error);
    }
  }

  async getOrders(req, res, next) {
    try {
      const orders = await this.service.previewOrders(req.query.count);
      return success(res, { count: orders.length, orders });
    } catch (error) {
      return next(error);
    }
  }

  async getDeliveries(req, res, next) {
    try {
      const deliveries = await this.service.previewDeliveries(req.query.count);
      return success(res, { count: deliveries.length, deliveries });
    } catch (error) {
      return next(error);
    }
  }

  async getDataset(req, res, next) {
    try {
      const dataset = await this.service.previewDataset(req.query);
      return success(res, dataset);
    } catch (error) {
      return next(error);
    }
  }

  // --- Persistencia controlada -------------------------------------------

  async generateData(req, res, next) {
    try {
      const result = await this.service.persistDataset(req.body, req.requester.role);
      return success(res, result, HTTP_STATUS.CREATED);
    } catch (error) {
      return next(error);
    }
  }

  async getSummary(req, res, next) {
    try {
      const summary = await this.service.getSummary();
      return success(res, summary);
    } catch (error) {
      return next(error);
    }
  }

  async clear(req, res, next) {
    try {
      const result = await this.service.clearMocks(req.requester.role);
      return success(res, result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new MockController();
module.exports.MockController = MockController;
