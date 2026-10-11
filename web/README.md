# LinkQR Web

Cliente web de LinkQR, independiente de la aplicación Android y del backend.

## Tecnología

- HTML5 semántico, CSS responsive y JavaScript con módulos ES.
- Vite para servidor de desarrollo y empaquetado estático.
- `qrcode` para generar QR reales en el navegador.
- Sin framework de interfaz.

## Requisitos

Node.js `^20.19.0 || >=22.12.0` y npm.

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

## Documentación por fase

- [Fase 1 — Auditoría y arquitectura](../docs/WEB-PHASE-01-ARCHITECTURE.md)
- [Fase 2 — Configuración del proyecto](./README.md)
- [Fase 3 — Sistema visual responsive](./DESIGN-SYSTEM.md)
- [Fase 4 — Navegación y panel](./PHASE-04-NAVIGATION.md)
- [Fase 5 — Generación y validación QR](./PHASE-05-QR-GENERATOR.md)

## Estado funcional

- **Implementado:** panel y navegación; generación local de QR para URLs HTTP/HTTPS y texto libre con vista previa.
- **Pendiente:** personalización/exportación, escáner, historial persistente, favoritos, cuenta, sincronización, PWA y despliegue.
- La aplicación nunca recibe la clave administrativa del backend en el cliente web.
