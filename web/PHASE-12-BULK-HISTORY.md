# LinkQR Web — Fase 12: selección múltiple y acciones masivas

## Objetivo

Permitir administrar varios registros del historial local en una operación, conservando las funciones individuales y sin modificar el esquema almacenado.

## Funciones

- Casillas de selección individuales y control para seleccionar/deseleccionar todos los resultados visibles.
- Estado de selección visible, con conservación de selecciones existentes aunque cambie el filtro o la búsqueda; las selecciones de registros eliminados se descartan.
- Marcar varios registros como favoritos o quitarles el favorito en bloque.
- Copiar el contenido de varios registros al portapapeles en una sola operación.
- Exportar solo los registros seleccionados como copia JSON compatible con el formato de respaldo de la Fase 9.
- Eliminar los registros seleccionados después de pedir confirmación.

## Integridad

- Las operaciones masivas de favoritos y eliminación actualizan el historial con una única escritura local.
- Se deduplican los identificadores de entrada y los elementos no seleccionados permanecen sin cambios.
- Si el almacenamiento está dañado o no disponible, las acciones no escriben datos.
- El historial sigue limitado a 200 registros; las preferencias y los datos existentes no se reestructuran.
- La caché PWA avanza a `linkqr-pwa-v4` para renovar los recursos de la aplicación después de publicar esta versión.

## Verificación

Desde `web/`:

```bash
npm run check
npm test
npm run build
```

Las pruebas comprueban operaciones masivas de favoritos y eliminación, entradas duplicadas, selección vacía, almacenamiento corrupto y persistencia del resto de registros.
