/**
 * UserService - reglas de negocio de usuarios.
 *
 * Concentra: unicidad de email, hasheo de contrasena, validacion de roles,
 * permisos (quien puede tocar a quien) y la regla de "no quedarse sin admins".
 * No conoce Mongoose ni req/res.
 */
const bcrypt = require('bcrypt');
const userRepository = require('../repositories/user.repository');
const {
  ValidationError,
  ForbiddenRoleError,
  UserNotFoundError,
  EmailInUseError,
  InvalidCredentialsError,
  InvalidRoleError,
  LastAdminError,
} = require('../errors');
const { USER_ROLES, PAGINATION, SORT_ORDER } = require('../constants');
const { config } = require('../config');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD_LENGTH = 8;
const SORTABLE_FIELDS = ['createdAt', 'firstName', 'lastName', 'email'];

class UserService {
  constructor(repository = userRepository) {
    this.repository = repository;
  }

  // --- Helpers de dominio --------------------------------------------------

  #assertIsAdmin(requesterRole) {
    if (requesterRole !== USER_ROLES.ADMIN) {
      throw new ForbiddenRoleError({ requiredRole: USER_ROLES.ADMIN, receivedRole: requesterRole });
    }
  }

  /** Un usuario puede tocar su propio recurso; un admin puede tocar cualquiera. */
  #assertIsSelfOrAdmin(targetId, requester = {}) {
    const isSelf = requester.id !== undefined && String(requester.id) === String(targetId);
    if (!isSelf && requester.role !== USER_ROLES.ADMIN) {
      throw new ForbiddenRoleError({ reason: 'Solo el propio usuario o un administrador pueden operar sobre este recurso' });
    }
  }

  #validateEmail(email) {
    const normalized = String(email || '').toLowerCase().trim();
    if (!EMAIL_REGEX.test(normalized)) {
      throw new ValidationError([{ field: 'email', message: 'No tiene un formato valido', received: email }]);
    }
    return normalized;
  }

  #validatePassword(password) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError([
        { field: 'password', message: `Debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
      ]);
    }
    return password;
  }

  #validateRole(role) {
    if (!Object.values(USER_ROLES).includes(role)) {
      throw new InvalidRoleError(role, Object.values(USER_ROLES));
    }
    return role;
  }

  /**
   * Impide dejar el sistema sin administradores: si el usuario objetivo es el
   * unico admin activo, no se lo puede degradar ni dar de baja.
   */
  async #assertIsNotLastAdmin(user) {
    if (user.role !== USER_ROLES.ADMIN) return;
    const admins = await this.repository.countBy({ role: USER_ROLES.ADMIN });
    if (admins <= 1) throw new LastAdminError();
  }

  #normalizeQuery(query = {}) {
    const page = Math.max(Number.parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE, 1);
    const requestedLimit = Number.parseInt(query.limit, 10) || config.defaultPageSize;
    const limit = Math.min(Math.max(requestedLimit, 1), PAGINATION.MAX_LIMIT);

    const filter = {};
    if (query.role) filter.role = this.#validateRole(query.role);

    const sortBy = SORTABLE_FIELDS.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const order = query.order === SORT_ORDER.ASC ? SORT_ORDER.ASC : SORT_ORDER.DESC;

    return { filter, page, limit, sortBy, order };
  }

  // --- Casos de uso --------------------------------------------------------

  /** Listado de usuarios. Solo para administradores. */
  async getAll(query = {}, requesterRole) {
    this.#assertIsAdmin(requesterRole);

    const { filter, page, limit, sortBy, order } = this.#normalizeQuery(query);
    const result = await this.repository.getAll({ filter, page, limit, sortBy, order });

    return {
      users: result.docs.map((user) => this.#withFullName(user)),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasPrevPage: result.page > 1,
        hasNextPage: result.page < result.totalPages,
      },
    };
  }

  /** Campo derivado: se arma en el Service, no se guarda en la base. */
  #withFullName(user) {
    return { ...user, fullName: `${user.firstName} ${user.lastName}`.trim() };
  }

  async getById(id, requester = {}) {
    this.#assertIsSelfOrAdmin(id, requester);

    const user = await this.repository.getById(id);
    if (!user) throw new UserNotFoundError(id);
    return this.#withFullName(user);
  }

  /**
   * Alta de usuario. El rol solo puede elegirlo un admin: un registro publico
   * siempre crea un USER.
   */
  async create(payload = {}, requesterRole) {
    const { firstName, lastName, email, password, role } = payload;

    const missing = ['firstName', 'lastName', 'email', 'password'].filter(
      (field) => payload[field] === undefined || String(payload[field]).trim() === ''
    );
    if (missing.length > 0) {
      throw new ValidationError(
        missing.map((field) => ({ field, message: 'Es obligatorio' })),
        `Faltan campos obligatorios: ${missing.join(', ')}`
      );
    }

    const normalizedEmail = this.#validateEmail(email);
    this.#validatePassword(password);

    let finalRole = USER_ROLES.USER;
    if (role !== undefined) {
      this.#assertIsAdmin(requesterRole);
      finalRole = this.#validateRole(role);
    }

    const existing = await this.repository.getByEmail(normalizedEmail, { includeInactive: true });
    if (existing) throw new EmailInUseError(normalizedEmail);

    // El hasheo es regla de negocio: vive aca, no en el modelo ni en el repo.
    const hashedPassword = await bcrypt.hash(password, config.saltRounds);

    const created = await this.repository.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: finalRole,
    });

    return this.#withFullName(created);
  }

  /** Actualiza datos propios (o de cualquiera si es admin). El rol va aparte. */
  async update(id, payload = {}, requester = {}) {
    this.#assertIsSelfOrAdmin(id, requester);

    const current = await this.repository.getById(id);
    if (!current) throw new UserNotFoundError(id);

    const changes = {};

    if (payload.firstName !== undefined) changes.firstName = String(payload.firstName).trim();
    if (payload.lastName !== undefined) changes.lastName = String(payload.lastName).trim();

    if (payload.email !== undefined) {
      const normalizedEmail = this.#validateEmail(payload.email);
      if (normalizedEmail !== current.email) {
        const duplicated = await this.repository.getByEmail(normalizedEmail, { includeInactive: true });
        if (duplicated) throw new EmailInUseError(normalizedEmail);
        changes.email = normalizedEmail;
      }
    }

    if (payload.password !== undefined) {
      this.#validatePassword(payload.password);
      changes.password = await bcrypt.hash(payload.password, config.saltRounds);
    }

    // El rol nunca se cambia por esta via: tiene su propio caso de uso.
    if (payload.role !== undefined) {
      throw new ValidationError(
        [{ field: 'role', message: 'El rol no se cambia por esta via' }],
        'Para cambiar el rol usa PATCH /api/users/:uid/role'
      );
    }

    if (Object.keys(changes).length === 0) {
      throw new ValidationError(
        { allowedFields: ['firstName', 'lastName', 'email', 'password'] },
        'No se enviaron campos validos para actualizar'
      );
    }

    const updated = await this.repository.update(id, changes);
    if (!updated) throw new UserNotFoundError(id);
    return this.#withFullName(updated);
  }

  /** Cambio de rol: exclusivo de administradores y protegido por la regla del ultimo admin. */
  async changeRole(id, role, requesterRole) {
    this.#assertIsAdmin(requesterRole);
    const newRole = this.#validateRole(role);

    const user = await this.repository.getById(id);
    if (!user) throw new UserNotFoundError(id);

    if (user.role === newRole) return this.#withFullName(user);
    if (newRole !== USER_ROLES.ADMIN) await this.#assertIsNotLastAdmin(user);

    const updated = await this.repository.update(id, { role: newRole });
    return this.#withFullName(updated);
  }

  /** Baja logica. Solo admin, y nunca sobre el ultimo administrador activo. */
  async delete(id, requesterRole) {
    this.#assertIsAdmin(requesterRole);

    const user = await this.repository.getById(id);
    if (!user) throw new UserNotFoundError(id);

    await this.#assertIsNotLastAdmin(user);

    const deleted = await this.repository.softDelete(id);
    if (!deleted) throw new UserNotFoundError(id);
    return this.#withFullName(deleted);
  }

  /**
   * Verificacion de credenciales. Devuelve el usuario sin el hash.
   * (La emision de tokens/sesion queda para el modulo de autenticacion.)
   */
  async verifyCredentials(email, password) {
    const normalizedEmail = this.#validateEmail(email);
    const user = await this.repository.getByEmailWithPassword(normalizedEmail);
    if (!user) throw new InvalidCredentialsError();

    const isValid = await bcrypt.compare(String(password), user.password);
    if (!isValid) throw new InvalidCredentialsError();

    const { password: _omit, ...safeUser } = user;
    return this.#withFullName(safeUser);
  }
}

module.exports = new UserService();
module.exports.UserService = UserService;
