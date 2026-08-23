# ---------------------------------------------------------------------------
# ShipNow API
#
# Build en dos etapas: la primera resuelve las dependencias y la segunda arma
# la imagen final. Asi el cache de npm y las herramientas de compilacion de
# bcrypt no quedan dentro de la imagen que se despliega.
# ---------------------------------------------------------------------------

# --- Etapa 1: dependencias -------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Solo los manifiestos: mientras no cambien, Docker reutiliza esta capa y no
# vuelve a instalar en cada build.
COPY package.json package-lock.json ./

# `npm ci` instala exactamente lo que dice el lockfile.
# `--omit=dev` deja fuera mocha, chai, supertest y demas: no van a produccion.
RUN npm ci --omit=dev && npm cache clean --force

# --- Etapa 2: imagen final -------------------------------------------------
FROM node:22-alpine AS runner

# `tini` como PID 1: reenvia las senales para que SIGTERM llegue a Node y el
# cierre ordenado del servidor funcione de verdad.
RUN apk add --no-cache tini

ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Carpetas de escritura. Se crean con el usuario de la app como dueno, porque
# el proceso no corre como root.
RUN mkdir -p logs uploads && chown -R node:node /app

# Nunca root: si alguien escapa del proceso, no es administrador del contenedor.
USER node

# Documenta el puerto. El real lo define PORT en tiempo de ejecucion.
EXPOSE 8080

# El orquestador puede consultar el estado real de la API, no solo si el
# proceso vive. Usa el health check del Modulo 8.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 8080) + '/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
