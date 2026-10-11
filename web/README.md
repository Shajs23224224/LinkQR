# LinkQR Web

Interfaz web ligera para LinkQR, separada de la aplicación Android y del backend.

## Tecnología

- HTML5 semántico
- CSS nativo con tokens y breakpoints
- JavaScript ES modules
- Sin dependencias de ejecución externas

## Ejecutar

Desde `web/`:

```bash
npm run dev
```

Abrir http://localhost:4173.

## Comprobación estática

```bash
npm run check
```

Este comando verifica la sintaxis de los módulos principales. No sustituye pruebas de navegador.

## Documentación por fase

- [Fase 1 — Auditoría y arquitectura](../docs/WEB-PHASE-01-ARCHITECTURE.md)
- [Fase 2 — Configuración del proyecto](./README.md)
- [Fase 3 — Sistema visual responsive](./DESIGN-SYSTEM.md)
- [Fase 4 — Navegación y panel](./PHASE-04-NAVIGATION.md)

## Estado actual

Fase 4 establece el shell de navegación y vistas informativas preparadas. La generación/escaneo real, almacenamiento, autenticación, sincronización y despliegue se implementarán en sus fases correspondientes.
