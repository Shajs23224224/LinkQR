# Fase 13 — Etiquetas personalizadas y filtros avanzados

## Objetivo

Organizar el historial local de LinkQR con etiquetas definidas por el usuario, sin alterar las rutas, favoritos ni las copias de seguridad existentes.

## Funcionalidad

- Añadir, editar o quitar etiquetas individualmente desde cada registro.
- Mostrar etiquetas como chips y filtrar el historial o favoritos por cualquier etiqueta existente.
- Conservar búsqueda por contenido y filtro por origen al filtrar etiquetas.
- Añadir o quitar etiquetas a una selección de registros desde acciones masivas.
- Normalizar nombres quitando espacios exteriores, convirtiendo a minúsculas y eliminando duplicados.
- Limitar cada registro a 10 etiquetas de 32 caracteres. Las operaciones masivas validan todos los cambios antes de guardar y escriben una sola vez en `localStorage`.

## Compatibilidad y límites

Los registros históricos y las copias JSON sin el campo `tags` siguen siendo válidos y se cargan con una lista vacía. Se conserva el formato de copia `linkqr-history-backup` versión 1. Las etiquetas se guardan localmente en este navegador y no se sincronizan todavía entre dispositivos.

## Verificación

Las pruebas cubren normalización, límites, operaciones masivas atómicas y restauración de copias antiguas. La caché de la PWA se incrementa a `linkqr-pwa-v5`.
