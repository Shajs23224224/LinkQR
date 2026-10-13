# LinkQR Web — Fase 11: ajustes funcionales

## Objetivo

Dar utilidad real a la sección Ajustes y mantener las preferencias locales separadas del historial, las copias de seguridad y el backend.

## Preferencias disponibles

- Tipo de contenido predeterminado del generador: URL o texto.
- Color del patrón y del fondo, tamaño de PNG y margen del QR. La combinación se valida antes de guardar y mantiene el contraste mínimo de 4.5:1.
- Guardado automático independiente de los QR generados y de los resultados escaneados en el historial local.
- Guardar/restablecer preferencias con un esquema versionado en `localStorage`; valores corruptos o incompatibles vuelven a los valores predeterminados de forma segura.
- Accesos directos al historial, las copias JSON de la Fase 9 y los favoritos.

## Comportamiento

- Los valores de generación se aplican al abrir el generador; pueden cambiarse para un QR individual sin reescribir automáticamente los ajustes.
- Si desactivas el guardado automático, el código PNG o el resultado leído siguen disponibles en pantalla, pero no se agregan registros nuevos al historial.
- Restablecer ajustes no borra los QR existentes, favoritos ni copias de seguridad.
- Las preferencias solo viven en el navegador actual. No hay cuenta ni sincronización entre dispositivos.

## Verificación

Ejecutar desde `web/`:

```bash
npm run check
npm test
npm run build
```

Las pruebas cubren valores predeterminados, persistencia, validación, recuperación ante datos corruptos e inicialización de fábrica.
