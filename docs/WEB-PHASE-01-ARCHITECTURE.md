# LinkQR Web — Fase 1: auditoría y arquitectura

## 1. Objetivo y alcance

Definir cómo se construirá la interfaz web de LinkQR sobre el repositorio existente, manteniendo separadas la aplicación Android, la interfaz web y el servicio backend. Este documento registra la arquitectura objetivo y las decisiones que guiarán las fases siguientes; no implica que todos los módulos descritos ya estén implementados.

## 2. Auditoría del repositorio

La rama base `main` contiene dos piezas relevantes:

- **Android:** aplicación Kotlin con Jetpack Compose y arquitectura orientada a funcionamiento offline-first. La generación QR, historial y escaneo no deben depender de tener una cuenta o conexión.
- **Backend:** servicio Node.js/TypeScript con Fastify, validación de contratos con Zod y persistencia SQLite. La configuración del servidor establece el puerto predeterminado en `8080`.
- **Identidad y SaaS:** el backend ofrece rutas de autenticación, espacios de trabajo y registros QR sincronizados. Las funciones SaaS y de autenticación están deshabilitadas por defecto mediante configuración; el despliegue debe habilitarlas y configurarlas explícitamente.
- **Contrato QR:** el esquema del backend contempla `recordId`, `type`, `payload`, `createdAt`, `updatedAt`, `isFavorite`, colores, `marginModules`, `version`, `deviceId` y tombstones (`deleted`, `deletedAt`). El contenido tiene máximo de 2048 caracteres; los colores se validan como HEX de seis dígitos y el margen admite valores de 1 a 8.

## 3. Decisiones arquitectónicas

1. **Cliente independiente:** mantener la interfaz dentro de `web/`; no mezclarla con los módulos Gradle/Android ni alterar sus dependencias.
2. **Tecnología:** HTML semántico, CSS y módulos JavaScript ES nativos. No introducir un framework ni dependencias de ejecución hasta que una necesidad concreta lo justifique.
3. **Separación por responsabilidades:** mantener configuración, contratos/dominio, acceso HTTP, persistencia local, sincronización y presentación en módulos separados a medida que se implementen.
4. **Offline-first:** la generación y la experiencia local deben poder funcionar sin sesión ni red. La cuenta y la sincronización son capacidades opcionales.
5. **API como fuente de autoridad:** el backend valida identidad, pertenencia a espacios de trabajo, cuotas, revisiones y conflictos. No confiar en permisos, plan PRO o identificadores enviados por el cliente.
6. **Secretos en servidor:** la clave `LINKQR_SAAS_API_KEY` es exclusivamente de servidor y jamás se empaquetará en HTML, JavaScript, variables de compilación públicas ni almacenamiento del navegador.
7. **Configuración por entorno:** el cliente expone una URL base configurable. El valor local debe coincidir con el backend (`http://localhost:8080` por defecto); producción utilizará HTTPS y la URL real desplegada.
8. **Compatibilidad de contrato:** modelar los campos y reglas que define el backend. No crear una segunda regla de resolución de conflictos que se aparte de la comparación compartida del servidor.
9. **Accesibilidad y rendimiento:** semántica HTML, operación por teclado, foco visible, objetivos táctiles, movimiento reducido y ausencia de recursos remotos innecesarios.

## 4. Estructura objetivo de la web

Los archivos actuales son el esqueleto inicial. La separación modular que se incorporará de forma incremental es:

```text
web/
├── index.html
├── package.json
├── README.md
├── DESIGN-SYSTEM.md
└── src/
    ├── main.js
    ├── config.js
    ├── styles.css
    ├── core/
    │   ├── api/          # cliente HTTP y adaptadores de endpoints
    │   ├── domain/       # modelo QR, validación y reglas puras
    │   └── storage/      # persistencia local
    ├── features/
    │   ├── generator/
    │   ├── scanner/
    │   ├── history/
    │   ├── account/
    │   └── settings/
    └── ui/
        └── components/   # controles y componentes reutilizables
```

La estructura dentro de `core/`, `features/` y `ui/` es planificada y se creará cuando cada fase necesite esos módulos. No se deben crear capas vacías solo para completar el árbol.

## 5. Integración API prevista

### Autenticación

El backend dispone de rutas como:

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/verify-email`
- `POST /v1/auth/password-reset/request`
- `POST /v1/auth/password-reset/confirm`
- `GET /v1/auth/me`
- Rutas para consultar/revocar sesiones y cerrar sesión.

Las solicitudes de usuario se autorizarán mediante el token de sesión Bearer que emite el backend. Antes de liberar la interfaz pública, se revisará el ciclo de vida del token en el navegador y los controles de seguridad adecuados para el despliegue.

### Espacios de trabajo y QR

La API SaaS expone configuración, listado/creación de espacios de trabajo, acceso a un espacio concreto y operaciones sobre registros QR. La lectura admite paginación con `cursor` y `limit` (máximo 100); la respuesta de delta incluye `cursor`, `nextCursor`, `hasMore` y registros. Los registros eliminados se representan mediante tombstones para permitir propagar eliminaciones durante la sincronización.

La integración debe comprobar en fases posteriores los estados de error, CORS/orígenes permitidos, timeouts, reintentos, idempotencia y comportamiento ante pérdida de red. No se presupone que CORS de producción ya esté configurado.

## 6. Flujos principales

1. **Sin cuenta:** abrir web, introducir datos, generar/visualizar QR y guardar registros localmente.
2. **Cuenta:** registrar o iniciar sesión; consultar la identidad con `/v1/auth/me`; cerrar sesión revocando el token.
3. **Sincronización:** seleccionar un espacio de trabajo autorizado, enviar revisiones locales, recibir conflictos y aplicar la versión ganadora según el contrato común.
4. **Modo desconectado:** mantener disponibles las capacidades locales; indicar al usuario cuando una operación de red no pueda completarse y reintentar de forma segura.

La generación local y el almacenamiento deben permanecer desacoplados del cliente HTTP.

## 7. Riesgos y puertas de control

- **CORS y despliegue:** validar dominios/orígenes del frontend antes de integrar llamadas desde el navegador.
- **Tokens en navegador:** evitar guardar secretos de servidor; definir explícitamente persistencia, expiración, logout y recuperación de sesión antes de implementar la pantalla de cuenta.
- **Conflictos y borrados:** preservar `version`, `deviceId` y tombstones. No borrar físicamente un registro pendiente de propagación.
- **Cuotas/planes:** mostrar información del plan como dato del servidor; nunca habilitar PRO únicamente por una decisión del cliente.
- **Compatibilidad QR:** la ilustración decorativa del sistema visual no es un QR escaneable. La generación real debe añadirse en la fase correspondiente.
- **Validación:** una comprobación de sintaxis no reemplaza pruebas de navegador, API, seguridad, accesibilidad ni compilación del backend.

## 8. Secuencia de fases

- **Fase 1:** auditoría y arquitectura (este documento).
- **Fase 2:** estructura inicial del proyecto y configuración centralizada.
- **Fase 3:** sistema visual responsive y componentes base.
- **Fase 4:** navegación y estructura del panel.
- **Fases posteriores:** generación/escaneo QR, exportación, almacenamiento, API, autenticación, sincronización, PWA, pruebas y despliegue.

## 9. Criterios de aceptación de arquitectura

- La web está aislada bajo `web/` y no introduce cambios en el módulo Android.
- Se reutilizan los contratos backend en vez de inventar un protocolo paralelo.
- Los secretos administrativos quedan en el servidor.
- Las funciones locales no dependen de conexión ni autenticación.
- Las fases siguientes pueden agregar módulos sin acoplar dominio, almacenamiento, API y presentación.
