# Fase 14 — Filtros temporales y ordenamiento del historial

## Funcionalidad

- Filtrar registros por tipo de contenido: URL o texto.
- Definir fecha inicial y final, interpretadas como días calendario locales e inclusivos.
- Ordenar por más recientes, más antiguos, contenido A–Z, favoritos primero o mayor cantidad de etiquetas.
- Combinar los filtros con búsqueda por contenido, origen y etiquetas existentes; también están disponibles en la vista de favoritos.
- Restablecer la búsqueda y todos los filtros con un solo control.
- Mostrar un estado específico cuando el rango de fechas es inválido.
- Mantener la selección múltiple y las acciones masivas operativas sobre los resultados visibles.

## Implementación y compatibilidad

La consulta y ordenación están aisladas en `history-query.js` para poder verificarlas por separado. No cambia el formato de datos ni el formato de las copias de seguridad. La caché de recursos de la PWA se incrementa a `linkqr-pwa-v6`.

## Verificación

Las pruebas unitarias cubren los filtros combinados, los extremos de fechas, los rangos inválidos, la ordenación y los registros antiguos que no tengan etiquetas.
