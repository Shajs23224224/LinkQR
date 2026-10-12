# LinkQR Web — Fase 6: personalización y exportación PNG

## Objetivo

Permitir personalizar el aspecto de un QR generado en el navegador y descargar el resultado como una imagen PNG cuadrada, sin enviar el contenido al backend.

## Implementación

- Selectores de color para el patrón y el fondo, tamaño PNG de 192 a 768 píxeles y margen blanco de 4, 6 u 8 módulos.
- Validación del color hexadecimal y del orden visual: el patrón debe ser más oscuro que el fondo.
- Cálculo de contraste relativo conforme a la fórmula de luminancia sRGB; se exige una relación mínima de 4.5:1 como filtro de accesibilidad y una ayuda adicional para favorecer el escaneo.
- Margen predeterminado de cuatro módulos para conservar el área despejada alrededor del QR.
- Exportación directa mediante enlace de descarga PNG generado localmente con la biblioteca qrcode.
- Nombre de archivo que identifica el tipo de contenido y el tamaño; los controles se bloquean durante la generación para evitar estados inconsistentes.
- Cambiar contenido o personalización invalida la vista previa anterior, evitando descargar accidentalmente una imagen obsoleta.
- Mensajes accesibles de estado y error, controles con etiquetas y diseño responsive.

## Pruebas

Se amplían las pruebas unitarias para cubrir cálculo de contraste, valor predeterminado, normalización de colores y entradas inválidas (contraste bajo, colores invertidos, tamaño no permitido y margen inválido). Ejecutar `npm run check`, `npm test` y `npm run build` desde el directorio `web/`.

## Límites

La descarga PNG se genera en el cliente y no requiere almacenamiento. El escáner, el historial y los favoritos siguen reservados para fases posteriores. Una relación de contraste suficiente reduce el riesgo de mala lectura, pero no garantiza que todos los dispositivos puedan escanear todos los códigos; también influyen el contenido, la impresión, la nitidez y el tamaño físico.
