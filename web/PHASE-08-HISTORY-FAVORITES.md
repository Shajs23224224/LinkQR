# LinkQR Web — Fase 8: historial local y favoritos

## Objetivo

Conservar los códigos QR generados y escaneados, consultar el historial, buscar registros y administrar favoritos sin depender de una cuenta ni del backend.

## Implementación

- Persistencia en `localStorage` con el esquema versionado `linkqr.history.v1`.
- Registros con origen, tipo, contenido, fecha e identificador; límite de 200 elementos para mantener controlado el tamaño.
- Generador y escáner guardan automáticamente los resultados completados. Los fallos de almacenamiento se informan sin invalidar el QR que se acaba de crear o leer.
- Historial con búsqueda, filtro por origen, copiar, eliminar un registro y borrado total con confirmación.
- Vista separada de favoritos con acciones para marcar o quitar un favorito.
- Acción «Recrear QR» desde registros cuyo contenido cabe en el límite de 2048 bytes: precarga el generador mediante un borrador temporal de sesión que se consume una sola vez.
- Contenido dinámico renderizado mediante `textContent`; solo se activan enlaces HTTP/HTTPS válidos sin credenciales.
- Manejo de almacenamiento no disponible, cuota agotada, JSON corrupto y versión incompatible.
- Actualización de vistas mediante eventos de la pestaña actual y cambios de `localStorage` en otras pestañas.

## Privacidad y límites

Los datos permanecen en este navegador; no se sincronizan entre dispositivos ni se cifran automáticamente. Pueden desaparecer al borrar los datos del sitio, usar navegación privada o cambiar de navegador/dispositivo. Evita guardar datos sensibles en los QR que compartas.

## Pruebas

Las pruebas cubren persistencia, favoritos, eliminación, límite de registros, borrado total, recuperación ante JSON corrupto y precarga de un registro al generador con validación del contenido. Ejecutar `npm run check`, `npm test` y `npm run build` desde `web/`.
