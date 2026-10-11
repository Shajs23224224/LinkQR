# LinkQR Web — Fase 01: arquitectura y planificación

**Estado:** propuesta técnica para revisión  
**Stack objetivo:** HTML5, CSS3 y JavaScript nativo (ES modules)  
**Repositorio base:** `Shajs23224224/LinkQR`  
**Rama de trabajo:** `web/phase-01-architecture`

## 1. Objetivo

Definir la arquitectura de la aplicación web antes de implementar componentes. La web debe reutilizar el backend SaaS existente y mantener compatibilidad de datos con Android, sin copiar al navegador reglas de autorización que deben permanecer en el servidor.

Esta fase es de diseño y documentación. No introduce todavía la interfaz funcional, paquetes, endpoints nuevos ni cambios en el backend.

## 2. Hallazgos confirmados en el repositorio

- La aplicación existente es Android nativo; la versión web se debe aislar en un directorio propio para no interferir con Gradle.
- El backend está en `backend/`, utiliza Node.js, TypeScript, Fastify, Zod y SQLite.
- El contrato de QR SaaS está definido en `backend/src/saas.ts` mediante `WorkspaceQrRecordSchema`.
- El backend ya implementa autenticación y operaciones SaaS en `backend/src/authRoutes.ts` y `backend/src/saasRoutes.ts`.
- El conflicto de sincronización se determina por `version`, después `deviceId` y finalmente `updatedAt`; el cliente web debe respetar exactamente este orden.
- El backend usa sesiones Bearer y también admite una API key para flujos SaaS. La API key del servidor **nunca** debe incorporarse al JavaScript entregado al navegador.

### Endpoints existentes relevantes

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/v1/auth/register` | Crear cuenta y solicitar verificación de correo |
| POST | `/v1/auth/login` | Iniciar sesión |
| POST | `/v1/auth/verify-email` | Verificar correo |
| POST | `/v1/auth/password-reset/request` | Solicitar restablecimiento |
| POST | `/v1/auth/password-reset/confirm` | Confirmar restablecimiento |
| GET | `/v1/auth/me` | Consultar sesión actual |
| POST | `/v1/auth/logout` | Cerrar sesión |
| GET | `/v1/saas/config` | Consultar disponibilidad y límites de planes |
| GET/POST | `/v1/saas/workspaces` | Listar o crear espacios de trabajo |
| GET | `/v1/saas/workspaces/:workspaceId` | Consultar un espacio |
| GET/POST | `/v1/saas/workspaces/:workspaceId/qr` | Leer registros o sincronizar un registro QR |

Para delta sync, el GET de registros admite `cursor` y `limit`; los límites observados en el backend son de 1 a 100 por página. Debe usarse el cursor devuelto por el servidor y conservar los tombstones (`deleted`, `deletedAt`) durante la sincronización.

**Pendiente de verificación en la siguiente fase:** configuración de CORS para el dominio web, disponibilidad de HTTPS, forma de persistencia de sesión adecuada para navegador, comportamiento real de cada ruta con usuarios normales y permisos de workspace. No se asume que el backend esté listo para producción web solo porque las rutas existan.

## 3. Arquitectura propuesta

Se usará una arquitectura modular por funciones y capas ligeras, sin framework obligatorio.

```text
web/
├── index.html
├── assets/
│   ├── icons/
│   └── images/
├── css/
│   ├── tokens.css
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── responsive.css
├── js/
│   ├── app.js
│   ├── router.js
│   ├── config.js
│   ├── core/
│   │   ├── errors.js
│   │   ├── events.js
│   │   └── validators.js
│   ├── features/
│   │   ├── generator/
│   │   ├── scanner/
│   │   ├── history/
│   │   ├── favorites/
│   │   ├── settings/
│   │   └── account/
│   ├── services/
│   │   ├── api-client.js
│   │   ├── auth-service.js
│   │   └── workspace-service.js
│   ├── storage/
│   │   └── indexed-db.js
│   ├── sync/
│   │   ├── sync-manager.js
│   │   └── conflict-resolver.js
│   └── ui/
│       ├── components.js
│       └── notifications.js
├── manifest.webmanifest
└── service-worker.js  # se incorpora en la fase PWA, no ahora
```

El árbol es la estructura objetivo, no una lista de archivos que deban crearse todos en esta fase. El directorio de trabajo será `web/` y el backend continuará en `backend/`.

### Responsabilidades

- **HTML:** estructura semántica, formularios y regiones accesibles.
- **CSS:** tokens de diseño, componentes y breakpoints; estilos sin dependencias de lógica.
- **JavaScript de funciones:** estado y acciones de cada funcionalidad.
- **Servicios:** comunicación HTTP, autenticación y espacios de trabajo.
- **Almacenamiento:** caché local y datos del usuario en IndexedDB; no sustituye al servidor como autoridad.
- **Sincronización:** cola de cambios, cursores, reintentos y resolución de conflictos compatibles con Android.
- **Backend:** autorización, cuotas FREE/PRO, validación definitiva, propiedad del workspace y persistencia remota.

## 4. Contrato de datos QR compartido

El modelo web debe mantener los campos que espera el backend:

| Campo | Regla / uso |
|---|---|
| `recordId` | Identificador estable del registro |
| `type` | Tipo de contenido QR |
| `payload` | Contenido; máximo de 2048 caracteres según el esquema actual |
| `createdAt`, `updatedAt` | Marcas de tiempo numéricas en milisegundos |
| `isFavorite` | Estado de favorito |
| `foregroundColor`, `backgroundColor` | Colores hexadecimales `#RRGGBB` |
| `marginModules` | Entero entre 1 y 8 |
| `version` | Versión entera positiva usada en resolución de conflictos |
| `deviceId` | Identificador persistente de instalación/navegador, no un secreto |
| `deleted`, `deletedAt` | Tombstone para propagar eliminaciones |

No cambiar nombres, unidades, valores por defecto ni orden de resolución de conflictos sin una migración coordinada de Android y backend. La validación del navegador mejora UX, pero el servidor sigue siendo la autoridad.

## 5. Flujos principales

### Generación de QR

1. El usuario selecciona un tipo de contenido.
2. La UI valida campos y presenta errores accesibles.
3. El módulo generador convierte el contenido a una representación QR.
4. La vista previa permite comprobar el resultado.
5. El usuario exporta o guarda el registro.
6. El almacenamiento local confirma el guardado; si hay sesión y workspace válidos, se programa sincronización.

### Acceso y sesión

1. El usuario inicia sesión mediante `POST /v1/auth/login`.
2. El cliente consulta `GET /v1/auth/me` para validar la sesión.
3. Las llamadas autenticadas usan el mecanismo admitido por el backend.
4. Un 401 limpia el estado local de sesión y devuelve al usuario al acceso.
5. El cierre de sesión llama a `POST /v1/auth/logout`.

**Decisión de seguridad:** no almacenar credenciales, API keys ni tokens sensibles en código fuente, URLs o logs. Antes de producción se debe elegir explícitamente entre sesión en memoria (más segura frente a robo persistente pero se pierde al recargar) o adaptar el backend para cookie `HttpOnly; Secure; SameSite` con protección CSRF. No persistir el Bearer en `localStorage` como opción por defecto.

### Sincronización

1. Leer cambios locales pendientes.
2. Enviar los registros al endpoint de workspace.
3. Tratar 401, 403, 409, 429 y errores de red de forma diferenciada.
4. Ante 409 `SYNC_CONFLICT`, comparar con el registro ganador devuelto por el backend y reconciliar sin descartar cambios silenciosamente.
5. Descargar páginas delta con `cursor` y `limit`.
6. Aplicar registros y tombstones de manera idempotente.
7. Persistir el cursor solo después de confirmar que la página se aplicó correctamente.
8. Continuar mientras `hasMore` sea verdadero; mantener los cambios pendientes si la red falla.

No se implementará el motor completo de sincronización en esta fase; estas reglas son el contrato de diseño para la fase correspondiente.

## 6. Decisiones técnicas

1. **Sin framework de frontend inicialmente:** HTML5, CSS3 y ES modules para respetar el alcance pedido. Evitar añadir una herramienta de compilación hasta que una necesidad real lo justifique.
2. **Cliente HTTP centralizado:** una única capa debe definir URL base, headers, serialización, timeout/abort y normalización de errores.
3. **Configuración por entorno:** la URL del backend no debe quedar dispersa por los módulos. No incluir secretos en variables públicas de frontend.
4. **IndexedDB para registros:** manejar esquemas versionados y operaciones transaccionales; no usar `localStorage` para el historial completo.
5. **Generador y lector QR desacoplados:** elegir bibliotecas en fase de implementación después de revisar licencia, mantenimiento, tamaño y compatibilidad móvil.
6. **PWA diferida:** manifiesto, service worker y estrategia offline se implementarán en la fase 13 del plan general.
7. **Accesibilidad desde el inicio:** navegación por teclado, etiquetas, foco visible, contraste y mensajes de estado anunciables.
8. **Sin confianza en el cliente:** cuotas, propiedad de datos y derechos PRO se verifican en backend.

## 7. Riesgos y verificaciones pendientes

- **CORS:** confirmar que el backend autoriza explícitamente los orígenes de desarrollo y producción; no abrirlo a cualquier origen con credenciales.
- **Autenticación web:** confirmar política de almacenamiento/renovación de sesión antes de producción.
- **Google Play Billing:** no asumir que una compra Android habilita automáticamente un flujo de pago web; definir la política de entitlement y facturación entre plataformas.
- **Workspace:** la UI debe permitir seleccionar el workspace apropiado; no escoger silenciosamente el primer workspace si existen varios.
- **Sincronización concurrente:** cubrir conflictos entre dos navegadores y Android, incluyendo borrados.
- **Privacidad:** no registrar payloads QR, tokens ni datos personales en logs de cliente.
- **Exportación y cámara:** comprobar compatibilidad, permisos y uso bajo HTTPS en navegadores móviles.

## 8. Criterios de aceptación de la fase 01

- [x] Repositorio y backend inspeccionados para establecer la base de la arquitectura.
- [x] Responsabilidades de HTML, CSS, módulos JS, almacenamiento, servicios y backend documentadas.
- [x] Rutas existentes relevantes identificadas a partir del código actual.
- [x] Modelo de QR y política de resolución de conflictos documentados.
- [x] Flujos de generación, autenticación y sincronización descritos.
- [x] Riesgos de sesión web, CORS, workspace y monetización registrados.
- [x] Decisiones que requieren cambios backend separadas de las que corresponden al frontend.
- [ ] Pruebas de navegador y compatibilidad CORS ejecutadas (se realizarán al comenzar implementación).
- [ ] Contrato de sesión web aprobado antes de habilitar autenticación persistente en producción.

## 9. Siguiente fase

**Fase 02 — Configuración del proyecto:** crear el esqueleto ejecutable dentro de `web/`, módulos ES iniciales, validaciones automatizadas, configuración por entorno y un flujo de CI independiente que no rompa la compilación Android ni las pruebas del backend.
