# Carpeta de archivos subidos

Acá se guardan los archivos que suben los usuarios a través de la API. **El contenido no se
versiona**: `.gitignore` ignora todo lo que hay dentro salvo este README, que existe para que
la carpeta quede documentada en el repositorio.

En MongoDB **no se guarda el archivo**, solo sus metadatos (nombre original, nombre generado,
ruta relativa, tipo MIME, tamaño, tipo de documento y fecha de carga).

## Estructura

```
uploads/
├── documents/            # documentos de usuario, separados por tipo
│   ├── id_card/
│   ├── driver_license/
│   ├── insurance/
│   ├── tax_id/
│   └── other/
└── receipts/
    ├── orders/           # comprobantes de pago de pedidos
    └── deliveries/       # comprobantes de entrega
```

Las subcarpetas se crean solas la primera vez que se sube un archivo de ese tipo.

## Nombres de archivo

No se conserva el nombre original en disco: dos usuarios podrían subir `dni.jpg` y pisarse, y
un nombre que viene del cliente no es de fiar. Se genera uno propio con el formato
`<timestamp>-<aleatorio>.<extensión>`, y el nombre original queda guardado en los metadatos.

## Entorno de testing

Los tests escriben en `uploads-test/`, una carpeta aparte que se borra entera al terminar la
suite. Así una corrida de tests nunca toca archivos reales.

Ver la configuración completa en [`src/config/multer.config.js`](../src/config/multer.config.js).
