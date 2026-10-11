# LinkQR Web — Fase 4: navegación y panel

## Incluido

- Shell de aplicación con sidebar, cabecera, migas de pan, contenido principal y pie.
- Navegación por hash para Inicio, Crear QR, Escáner, Historial, Favoritos y Ajustes.
- Indicador de navegación activo y atributo accesible `aria-current="page"`.
- Sidebar móvil desplegable con superposición, cierre con Escape y al cambiar de vista.
- Vistas de preparación para funcionalidades cuya implementación pertenece a fases siguientes.
- Panel de inicio con accesos rápidos y estados honestos de las funciones aún no conectadas.
- Ajuste de título del documento y foco en el encabezado al cambiar de ruta.
- Layouts responsive para escritorio, tablet y móvil; respeto a `prefers-reduced-motion`.

## Rutas disponibles

| Hash | Vista | Alcance actual |
| --- | --- | --- |
| `#/home` | Inicio | Panel informativo y accesos rápidos |
| `#/generator` | Crear QR | Generación local URL/texto disponible; detalles en Fase 5 |
| `#/scanner` | Escáner | Vista de preparación; lectura en Fase 7 |
| `#/history` | Historial | Vista de preparación; persistencia en Fase 8 |
| `#/favorites` | Favoritos | Vista de preparación; favoritos en Fase 8 |
| `#/settings` | Ajustes | Vista de preparación para preferencias/cuenta futuras |

## Arquitectura de navegación

La navegación usa URLs hash para servir desde un hosting estático sin requerir reescrituras del servidor. Las rutas están enumeradas en `src/main.js`; al cambiar de ruta se actualiza la vista, la etiqueta activa, la miga de pan y el título del documento.

El contenido de vistas actualmente se compone de plantillas estáticas internas. No se incorpora texto arbitrario de usuario en `innerHTML`.

## Accesibilidad

- Enlaces semánticos para navegación con historial/browser.
- Elemento `aria-current` en la ruta activa.
- Botón de menú móvil con `aria-controls` y `aria-expanded`.
- Cierre del menú por Escape y con superposición.
- Región de vista anunciada por `aria-live="polite"`.
- Al cambiar de ruta, el foco se desplaza al título de la página.

## Verificación

La estructura y los enlaces pueden probarse con servidor estático:

```bash
npm run dev
npm run check
```

Estas verificaciones no sustituyen pruebas manuales con teclado, lector de pantalla y tamaños de viewport reales. No se ha añadido aún un runner de pruebas de navegador a este proyecto.

## Fuera de alcance

No se genera ni escanea QR, no hay almacenamiento persistente, autenticación, sincronización ni datos reales en los indicadores del panel. Estas funciones se habilitarán en sus fases.
