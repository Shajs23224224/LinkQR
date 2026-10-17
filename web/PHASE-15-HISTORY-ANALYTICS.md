# Fase 15 — Estadísticas del historial QR

## Objetivo

Ofrecer una visión de conjunto del historial local para entender los tipos de QR guardados y la actividad reciente sin enviar datos a un servidor.

## Indicadores

- Total de registros guardados y distribución entre generados y escaneados.
- Distribución entre contenido URL y texto.
- Cantidad de favoritos, registros etiquetados y sin etiquetar, total de etiquetas distintas y porcentaje de favoritos.
- Actividad diaria de los últimos siete días (incluyendo el día actual).
- Ocho etiquetas más utilizadas, ordenadas por frecuencia.

## Arquitectura, privacidad y actualización

La función de resumen se encuentra en `history-analytics.js` y es independiente de la interfaz para facilitar su verificación. El panel se actualiza al cambiar el historial en esta pestaña o al recibir cambios de `localStorage` desde otra pestaña. Todos los datos se calculan en el navegador; no se incorporan servicios de analítica ni llamadas al backend.

Las métricas representan únicamente los registros existentes en el historial local, que actualmente está limitado a 200 elementos. La caché de la PWA se actualiza a `linkqr-pwa-v7`.

## Verificación

Las pruebas unitarias comprueban conteos, clasificaciones, frecuencias de etiquetas, actividad diaria, registros antiguos sin etiquetas y el comportamiento con el historial vacío.
