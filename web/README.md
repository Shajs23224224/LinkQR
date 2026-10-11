# LinkQR Web — Fase 2: configuración del proyecto

## Alcance

Esta fase crea un punto de entrada web independiente para preparar la implementación progresiva de LinkQR Web sin alterar la aplicación Android ni el backend existente.

## Decisiones técnicas

- HTML5 semántico, CSS3 y JavaScript nativo con módulos ES.
- Sin framework ni dependencias de ejecución añadidas.
- Configuración centralizada en `src/config.js`.
- URL base de API configurable mediante `globalThis.LINKQR_API_BASE_URL` antes de cargar el módulo principal; valor local por defecto: `http://localhost:8080`.
- Timeout de solicitud definido como constante de configuración para uso futuro.
- La clave administrativa/API del backend nunca debe incluirse en el cliente web.
- No se realizan llamadas de red en esta fase.

## Estructura

```text
web/
├── index.html
├── package.json
├── README.md
└── src/
    ├── config.js
    ├── main.js
    └── styles.css
```

## Ejecución local

Desde este directorio, con Python 3 instalado:

```bash
npm run dev
```

Abrir http://localhost:4173. Para detener el servidor, usar Ctrl+C.

## Comprobación estática

```bash
npm run check
```

La comprobación valida la sintaxis de los módulos JavaScript. No sustituye pruebas de navegador ni pruebas de integración.

## Fuera de alcance

Diseño visual final, navegación funcional, generación y lectura QR, autenticación, persistencia, sincronización, PWA y despliegue pertenecen a fases posteriores.
