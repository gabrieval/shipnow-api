/**
 * Prepara el entorno de testing despues de `npm install`.
 *
 * Motivo: quien clona el repositorio corria `npm install` y despues `npm test`,
 * y los tests fallaban solo porque faltaba copiar `.env.test.example` como
 * `.env.test`. Es un paso manual facil de olvidar y que no aporta nada: el
 * archivo de testing no tiene secretos ni valores propios de cada maquina.
 *
 * Reglas que respeta:
 *  - Si `.env.test` YA existe, no lo toca. Nunca pisa configuracion propia.
 *  - Si no encuentra el ejemplo (por ejemplo, dentro del build de Docker, donde
 *    solo se copian los manifiestos), no hace nada y termina bien.
 *  - Nunca falla: un problema preparando el entorno de testing no puede romper
 *    la instalacion de dependencias.
 *
 * NO copia `.env` de desarrollo a proposito: ahi si hay que elegir la URI de la
 * base a mano, y crearlo en silencio escondería el arranque fail-fast que valida
 * las variables criticas.
 *
 * Dos cosas que en el resto del proyecto serian un error y aca son correctas:
 *  - Usa `console.log` en vez del logger de Winston. Este script corre durante
 *    `npm install`, ANTES de que exista `.env`: importar el logger arrastraria
 *    la configuracion de entorno, que fallaria y romperia la instalacion.
 *  - Usa operaciones sincronicas de `fs`. No hay Event Loop que bloquear: es un
 *    script de un solo paso, no una peticion HTTP.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '../..');
const EJEMPLO = path.join(RAIZ, '.env.test.example');
const DESTINO = path.join(RAIZ, '.env.test');

try {
  if (!fs.existsSync(EJEMPLO)) process.exit(0);

  if (fs.existsSync(DESTINO)) {
    console.log('[setup] .env.test ya existe, se deja como esta');
    process.exit(0);
  }

  fs.copyFileSync(EJEMPLO, DESTINO);
  console.log('[setup] .env.test creado a partir de .env.test.example: ya se puede correr "npm test"');
} catch (error) {
  // Que esto falle no debe tumbar el `npm install`.
  console.log(`[setup] no se pudo preparar .env.test (${error.message}). Copialo a mano desde .env.test.example`);
}

process.exit(0);
