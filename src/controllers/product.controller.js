/**
 * ProductController - unica puerta de entrada HTTP para el catalogo.
 *
 * Responsabilidad: leer `req` (params, query, body, requester), llamar al
 * Service y elegir el status code. No importa Mongoose, no valida reglas de
 * negocio y no arma consultas: si aparece un `if` de dominio aca, va al Service.
 */
const productService = require('../services/product.service');
const { success } = require('../utils/apiResponse');
const { HTTP_STATUS } = require('../constants');

class ProductController {
  constructor(service = productService) {
    this.service = service;
    // Los metodos se pasan por referencia al router: fijamos el `this`.
    this.getAll = this.getAll.bind(this);
    this.getAvailable = this.getAvailable.bind(this);
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.decreaseStock = this.decreaseStock.bind(this);
    this.delete = this.delete.bind(this);
  }

  async getAll(req, res, next) {
    try {
      const result = await this.service.getAll(req.query);
      return success(res, result);
    } catch (error) {
      return next(error);
    }
  }

  async getAvailable(req, res, next) {
    try {
      const result = await this.service.getAvailable(req.query);
      return success(res, result);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const product = await this.service.getById(req.params.pid);
      return success(res, product);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const product = await this.service.create(req.body, req.requester.role);
      return success(res, product, HTTP_STATUS.CREATED);
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const product = await this.service.update(req.params.pid, req.body, req.requester.role);
      return success(res, product);
    } catch (error) {
      return next(error);
    }
  }

  async decreaseStock(req, res, next) {
    try {
      const product = await this.service.decreaseStock(req.params.pid, req.body.quantity);
      return success(res, product);
    } catch (error) {
      return next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const product = await this.service.delete(req.params.pid, req.requester.role);
      return success(res, { deleted: product._id ?? req.params.pid, code: product.code });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new ProductController();
module.exports.ProductController = ProductController;
