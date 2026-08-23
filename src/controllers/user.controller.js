/**
 * UserController - unica puerta de entrada HTTP para usuarios.
 *
 * Traduce request -> llamada al Service -> status code. Los permisos los
 * evalua el Service: el controller solo le pasa `req.requester`.
 */
const userService = require('../services/user.service');
const { success } = require('../utils/apiResponse');
const { HTTP_STATUS } = require('../constants');

class UserController {
  constructor(service = userService) {
    this.service = service;
    this.getAll = this.getAll.bind(this);
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.changeRole = this.changeRole.bind(this);
    this.delete = this.delete.bind(this);
    this.login = this.login.bind(this);
    this.uploadDocument = this.uploadDocument.bind(this);
  }

  async getAll(req, res, next) {
    try {
      const result = await this.service.getAll(req.query, req.requester.role);
      return success(res, result);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const user = await this.service.getById(req.params.uid, req.requester);
      return success(res, user);
    } catch (error) {
      return next(error);
    }
  }

  async create(req, res, next) {
    try {
      const user = await this.service.create(req.body, req.requester.role);
      return success(res, user, HTTP_STATUS.CREATED);
    } catch (error) {
      return next(error);
    }
  }

  async update(req, res, next) {
    try {
      const user = await this.service.update(req.params.uid, req.body, req.requester);
      return success(res, user);
    } catch (error) {
      return next(error);
    }
  }

  async changeRole(req, res, next) {
    try {
      const user = await this.service.changeRole(req.params.uid, req.body.role, req.requester.role);
      return success(res, user);
    } catch (error) {
      return next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const user = await this.service.delete(req.params.uid, req.requester.role);
      return success(res, { deleted: user._id ?? req.params.uid, email: user.email });
    } catch (error) {
      return next(error);
    }
  }

  async uploadDocument(req, res, next) {
    try {
      // `req.file` lo deja el middleware de Multer; el body trae el tipo de documento.
      const resultado = await this.service.uploadDocument(req.params.uid, req.file, req.body.documentType);
      return success(res, resultado, HTTP_STATUS.CREATED);
    } catch (error) {
      return next(error);
    }
  }

  async login(req, res, next) {
    try {
      const user = await this.service.verifyCredentials(req.body.email, req.body.password);
      return success(res, user);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = new UserController();
module.exports.UserController = UserController;
