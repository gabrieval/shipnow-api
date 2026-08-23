/**
 * OrderController - puerta de entrada HTTP de pedidos.
 * Lee `req`, llama al service y elige el status code. Nada mas.
 */
const orderService = require('../services/order.service');
const { success } = require('../utils/apiResponse');
const { HTTP_STATUS } = require('../constants');

class OrderController {
  constructor(service = orderService) {
    this.service = service;
    this.getAll = this.getAll.bind(this);
    this.create = this.create.bind(this);
    this.getById = this.getById.bind(this);
    this.updateStatus = this.updateStatus.bind(this);
  }

  async getAll(req, res, next) {
    try {
      return success(res, await this.service.getAll(req.query));
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      return success(res, await this.service.create(req.body), HTTP_STATUS.CREATED);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      return success(res, await this.service.getById(req.params.oid));
    } catch (error) {
      return next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      return success(res, await this.service.updateStatus(req.params.oid, req.body.status, req.requester.role));
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new OrderController();
module.exports.OrderController = OrderController;
