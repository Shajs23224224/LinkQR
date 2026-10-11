# LinkQR Web — Fase 5: generación y validación de códigos QR

## Objetivo

Generar códigos QR reales y escaneables para URLs HTTP/HTTPS y texto libre desde el navegador, con vista previa y validación antes de codificar el contenido.

## Implementación

- Generador modular en `src/features/generator/qr-generator.js`.
- Validación de contenido pura y testeable en `src/features/generator/validation.js`.
- Biblioteca `qrcode` para codificación QR del lado del cliente.
- Entrada por URL o texto libre, contador de bytes UTF-8 y límite de 2048 bytes por coherencia con el contrato de LinkQR.
- URLs restringidas a protocolos `http:` y `https:`; se rechazan protocolos ejecutables como `javascript:` y `data:`, direcciones incompletas y URLs con credenciales embebidas.
- Vista previa PNG con tamaño de 320 px, margen de cuatro módulos y nivel de corrección L, que da capacidad suficiente para contenidos largos dentro del límite de la aplicación.
- Manejo accesible de errores, anuncio de estado, bloqueo temporal de controles durante la generación y limpieza del resultado al cambiar el contenido.
- Integración con la ruta `#/generator` del panel existente.
- La generación ocurre localmente; no se envía el texto/URL al backend.
- No se persiste aún el contenido ni el resultado. La personalización y la descarga se reservarán para la Fase 6.

## Herramientas de desarrollo

Se incorpora Vite para servir los módulos y empaquetar la dependencia QR para hosting estático. Se mantiene JavaScript nativo, sin framework de interfaz.

Requisitos de Node.js admitidos por Vite 8: `^20.19.0 || >=22.12.0`.

Desde este directorio:

```bash
npm install
npm run dev
```

Abre http://localhost:4173.

## Validación y pruebas

```bash
npm run check
npm test
npm run build
npm run preview
```

Las pruebas unitarias usan el test runner nativo de Node.js y cubren URL segura, protocolo, entrada vacía y límites exactos de contenido en bytes UTF-8.

## Límites conocidos

- Solo están implementados los tipos URL y texto; más tipos de contenido se pueden agregar en fases futuras.
- La vista previa se muestra como PNG en la página, pero la descarga/exportación y personalización se implementan en Fase 6.
- La prueba de contrato verifica la validación local; una compilación Vite y la lectura física por dispositivos/cámaras requieren ejecutar el proyecto con sus dependencias instaladas y comprobar el resultado en navegador.
