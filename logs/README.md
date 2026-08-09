# Carpeta de logs

Winston escribe acá los archivos de log de ShipNow. **Los archivos que genera la aplicación
no se versionan**: `.gitignore` ignora todo el contenido de esta carpeta salvo este README,
que existe para que la carpeta quede documentada en el repositorio.

| Archivo | Niveles que contiene | Rotación |
| --- | --- | --- |
| `error-YYYY-MM-DD.log` | solo `error` y `fatal` | diaria, 5 MB por archivo, 14 días de historial |
| `combined-YYYY-MM-DD.log` | desde `info` hacia arriba (`info`, `warning`, `error`, `fatal`) | diaria, 10 MB por archivo, 7 días de historial |

Los archivos rotados se comprimen en `.gz` al cerrarse.

En entorno de **test** no se escribe ningún archivo: los transportes a disco quedan
deshabilitados para no ensuciar el repositorio en cada corrida.

Ver la configuración completa en [`src/config/logger.config.js`](../src/config/logger.config.js).
