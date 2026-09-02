/**
 * DeliveryController - puerta de entrada HTTP de entregas.
 */
const deliveryService = require('../services/delivery.service');
const { success } = require('../utils/apiResponse');
const { HTTP_STATUS } = require('../constants');

class DeliveryController {
  constructor(service = deliveryService) {
    this.service = service;
    this.getAll = this.getAll.bind(this);
    this.uploadReceipt = this.uploadReceipt.bind(this);
    this.getById = this.getById.bind(this);
    this.updateStatus = this.updateStatus.bind(this);
    this.assignCourier = this.assignCourier.bind(this);
  }

  async getAll(req, res, next) {
    try {
      return success(res, await this.service.getAll(req.query));
    } catch (error) {
      return next(error);
    }
  }

  async uploadReceipt(req, res, next) {
    try {
      return success(res, await this.service.uploadReceipt(req.params.did, req.file), HTTP_STATUS.CREATED);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      return success(res, await this.service.getById(req.params.did));
    } catch (error) {
      return next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      return success(res, await this.service.updateStatus(req.params.did, req.body.status, req.requester.role));
    } catch (error) {
      return next(error);
    }
  }

  async assignCourier(req, res, next) {
    try {
      return success(res, await this.service.assignCourier(req.params.did, req.body.courier, req.requester.role));
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new DeliveryController();
module.exports.DeliveryController = DeliveryController;
