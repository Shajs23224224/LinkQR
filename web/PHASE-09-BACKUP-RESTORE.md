# LinkQR Web — Fase 9: copias de seguridad y restauración

## Objetivo

Permitir mover o recuperar el historial y los favoritos sin cuenta ni servidor, mediante un archivo JSON portátil creado en el propio navegador.

## Implementación

- Exportación del historial local completo (hasta 200 registros) a `linkqr-backup-AAAA-MM-DD.json`.
- Esquema explícito `linkqr-history-backup`, versión 1, fecha de exportación y registros tipados.
- Importación desde archivo JSON en modo **Combinar con historial** (predeterminado) o **Reemplazar historial** (requiere confirmación).
- La combinación conserva los registros locales ante un conflicto de identificador y agrega registros nuevos, ordenados por fecha y limitados al máximo soportado.
- Validación completa antes de escribir: firma/formato, versión, estructura, tamaño máximo de 8 MB, máximo de 200 registros, identificadores únicos y campos requeridos.
- Importación atómica: si el archivo es inválido, no se modifica el almacenamiento. Si el historial local es ilegible, la combinación se bloquea y el reemplazo es una decisión explícita.
- El archivo se genera y se lee dentro del navegador; no se sube a LinkQR ni al backend.

## Privacidad y recomendaciones

El archivo puede contener todo el texto codificado en los QR del historial. Guárdalo en una ubicación privada y no compartas copias que contengan datos sensibles. La copia JSON no está cifrada ni protegida por contraseña.

## Verificación

Ejecutar en `web/`:

```bash
npm run check
npm test
npm run build
```

Las pruebas incluyen exportación, combinación, reemplazo, copias vacías, formato/versión inválidos, identificadores duplicados, registros inválidos, límite de tamaño y protección ante un historial local ilegible.
