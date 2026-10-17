# LinkQR Web

Cliente web de LinkQR, independiente de la aplicación Android y del backend.

## Tecnología

- HTML5 semántico, CSS responsive y JavaScript con módulos ES.
- Vite para servidor de desarrollo y empaquetado estático.
- `qrcode` para generar QR reales en el navegador.
- `@zxing/browser` y `@zxing/library` para lectura QR desde cámara o imagen.
- Sin framework de interfaz.

## Requisitos

Node.js `>=24.0.0` y npm.

## Ejecutar

Desde el directorio `web/`:

```bash
npm install
npm run dev
```

Abrir http://localhost:4173.

## Comandos de calidad

```bash
npm run check   # sintaxis de los módulos
npm test        # pruebas unitarias de validación
npm run build   # bundle estático de producción en dist/
npm run preview # servir el bundle de producción en localhost:4174
```

## Publicación en GitHub Pages

La web pública es https://shajs23224224.github.io/LinkQR/.

La publicación se construye desde `web/` y se despliega mediante el workflow `.github/workflows/deploy-web.yml`. En **Settings → Pages → Build and deployment → Source**, la opción debe ser **GitHub Actions**. No se debe publicar la raíz del repositorio como fuente de la web, porque allí está el README general del proyecto. El workflow escucha cambios en la rama `web/phase-01-restart` que afecten a `web/**` o al propio archivo de workflow.

## Documentación por fase

- [Fase 1 — Auditoría y arquitectura](../docs/WEB-PHASE-01-ARCHITECTURE.md)
- [Fase 2 — Configuración del proyecto](./README.md)
- [Fase 3 — Sistema visual responsive](./DESIGN-SYSTEM.md)
- [Fase 4 — Navegación y panel](./PHASE-04-NAVIGATION.md)
- [Fase 5 — Generación y validación QR](./PHASE-05-QR-GENERATOR.md)
- [Fase 6 — Personalización y exportación](./PHASE-06-CUSTOMIZATION-EXPORT.md)
- [Fase 7 — Escáner QR](./PHASE-07-SCANNER.md)
- [Fase 8 — Historial y favoritos](./PHASE-08-HISTORY-FAVORITES.md)
- [Fase 9 — Copias de seguridad e importación](./PHASE-09-BACKUP-RESTORE.md)
- [Fase 10 — PWA instalable y uso sin conexión](./PHASE-10-PWA-OFFLINE.md)
- [Fase 11 — Ajustes funcionales](./PHASE-11-SETTINGS.md)
- [Fase 12 — Selección múltiple y acciones masivas](./PHASE-12-BULK-HISTORY.md)
- [Fase 13 — Etiquetas y filtros avanzados](./PHASE-13-TAGS-FILTERS.md)
- [Fase 14 — Filtros temporales y ordenamiento](./PHASE-14-ADVANCED-HISTORY-FILTERS.md)

## Estado funcional

- **Implementado:** panel y navegación; generación QR personalizada con descarga PNG; lectura por cámara e imagen; historial local, búsqueda, filtros, favoritos, copia, selección múltiple, acciones masivas, reutilización en el generador y copias JSON importables/exportables y PWA instalable con recursos de la aplicación disponibles sin conexión tras la primera visita.
- **Implementado:** ajustes locales para valores QR predeterminados y control del guardado automático de historial.
- **Implementado:** etiquetas por registro, filtros dinámicos por etiqueta y aplicación/eliminación masiva de etiquetas con una sola escritura local.
- **Implementado:** filtros de historial por tipo de contenido y rango de fechas, cinco criterios de ordenación y restablecimiento de filtros.
- **Pendiente:** cuenta y sincronización entre dispositivos.
- La aplicación nunca recibe la clave administrativa del backend en el cliente web.
