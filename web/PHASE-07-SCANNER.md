# LinkQR Web — Fase 7: escáner QR

## Objetivo

Leer códigos QR desde una cámara disponible o desde una imagen raster local, mostrar el resultado como texto y facilitar copiarlo sin enviar datos a un servidor.

## Implementación

- `@zxing/browser` con `@zxing/library` para decodificación QR en el navegador.
- Cámara trasera preferida mediante el selector de dispositivo predeterminado de ZXing; la cámara se solicita únicamente tras pulsar «Iniciar cámara».
- Controles explícitos para iniciar y detener, liberación de las pistas de vídeo al leer un QR o abandonar la ruta, y manejo de errores habituales de permisos/dispositivo.
- Importación de imágenes PNG, JPEG, WebP, GIF, BMP y AVIF de hasta 10 MB. Las imágenes SVG se rechazan.
- Resultado de texto presentado con `textContent` y sin ejecutar su contenido. Solo se ofrece un enlace clicable para URLs HTTP/HTTPS válidas que no incluyan credenciales; se abre en una pestaña con `noopener noreferrer`.
- Acción para copiar el contenido leído y estado accesible para lector de pantalla.
- La decodificación ocurre en el navegador; no se almacena el resultado ni se sube la imagen.

## Requisitos de plataforma

La cámara requiere permiso del usuario y un contexto seguro: HTTPS en producción o localhost en desarrollo. Cuando no hay cámara o el permiso se deniega, sigue disponible el escaneo desde imagen.

## Verificación

Desde `web/`, ejecutar `npm run check`, `npm test` y `npm run build`. Las pruebas unitarias verifican límite/formato de archivos y que protocolos no HTTP(S) no se conviertan en enlaces automáticos.

## Límites

El escáner lee códigos QR; no implementa decodificación general de códigos de barras. La calidad, el enfoque, la iluminación y el recorte de la imagen influyen en la detección. El resultado todavía no se añade al historial: esa persistencia se reserva para la Fase 8.
