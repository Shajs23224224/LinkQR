# LinkQR — Arquitectura continuada: Fase 18 en adelante

Este documento define la evolución de LinkQR después de la Fase 17. Es un roadmap arquitectónico, no una autorización para implementar todas las fases de una sola vez.

Regla permanente del proyecto:

Implementar → compilar → probar → revisar → corregir → congelar → siguiente fase.

Cada fase debe producir cambios acotados, tests y una condición objetiva de salida.

---

## Mapa general

| Fase | Objetivo | Resultado |
|---|---|---|
| 18 | Hardening de producción 1.0 | Release Candidate |
| 19 | Seguridad avanzada de cuentas | Identidad apta para SaaS público |
| 20 | Sync resiliente y background | Sincronización confiable fuera de la UI |
| 21 | Observabilidad y operación | Backend operable en producción |
| 22 | Escalabilidad del almacenamiento | Persistencia preparada para crecimiento |
| 23 | Robustez de API y plataforma | API idempotente, rate-limited y versionada |
| 24 | Billing y entitlements de servidor | PRO verificable y auditable |
| 25 | Privacidad y gobierno de datos | Ciclo de vida de datos controlado |
| 26 | Rendimiento y pruebas de carga | Capacidad medida y límites conocidos |
| 27 | Calidad Android de producción | UX, accesibilidad y compatibilidad reforzadas |
| 28 | Dynamic QR y analítica | Producto SaaS de mayor valor |
| 29 | Administración y soporte | Operación de usuarios/workspaces |
| 30 | Alta disponibilidad y recuperación | Plataforma preparada para continuidad |

Las fases 18–27 priorizan confiabilidad y seguridad antes de ampliar el producto. Las fases 28–30 agregan capacidades SaaS sobre esa base.

---

# Fase 18 — Hardening y Release Candidate

## Objetivo

Convertir el estado actual de LinkQR en una versión candidata a producción, sin introducir nuevas funcionalidades de negocio importantes.

## Alcance

### Android
- Revisar estados de UI de carga, error, sesión expirada, sincronización, offline, compra PRO y permisos.
- Eliminar secretos, endpoints y configuraciones de desarrollo de release.
- Revisar BuildConfig y valores por variante debug/release.
- Confirmar que el backend administrativo nunca viaje dentro del APK.
- Configurar signing de producción fuera del repositorio.
- Generar AAB release firmado en un entorno seguro.
- Verificar ProGuard/R8, recursos y tamaño del paquete.

### Backend
- Separar configuración de desarrollo y producción.
- Validar CORS, headers y TLS detrás de un reverse proxy.
- Definir timeouts y límites de payload.
- Deshabilitar configuraciones de debug.
- Revisar migraciones SQLite y estrategia de backup.
- Añadir health/readiness checks.

### QA
- Smoke test de registro, login, logout, generación QR, historial, favoritos, borrado, sync, conflicto, tombstone y restauración de sesión.
- Pruebas de upgrade desde bases locales antiguas.
- Pruebas con backend temporalmente inaccesible.

## No hacer todavía
- No migrar a PostgreSQL todavía.
- No introducir microservicios.
- No implementar funciones de crecimiento antes de estabilizar producción.

## Gate de salida
- CI verde.
- Release build reproducible.
- Sin secretos en APK/repo.
- Migraciones verificadas.
- Smoke tests críticos verdes.
- Checklist de publicación cerrado.

---

# Fase 19 — Seguridad avanzada de identidad

## Objetivo

Completar la capa de identidad antes de exponer el SaaS a usuarios reales a escala.

## Componentes

### Cuenta
- Verificación de correo.
- Recuperación de contraseña.
- Cambio de contraseña.
- Revocación de sesiones.
- Lista de sesiones/dispositivos.
- Cierre remoto de sesiones.

### Protección
- Rate limiting por IP/cuenta/ruta.
- Protección contra credential stuffing.
- Política de contraseñas.
- Backoff en intentos fallidos.
- Auditoría de eventos de seguridad.

### Sesiones
- Rotación segura cuando corresponda.
- Expiración absoluta y/o por inactividad según política.
- Invalidación tras cambio de contraseña.

### MFA
- Diseñar segundo factor desacoplado del núcleo de autenticación.
- No acoplar MFA al modelo de QR.

## Gate
La autenticación debe soportar recuperación de cuenta, revocación y protección contra abuso sin romper el funcionamiento offline de la app.

---

# Fase 20 — Sync resiliente y background

## Objetivo

Sacar la sincronización del ciclo estrictamente ligado a abrir la pantalla autenticada y hacerla resistente a cortes de red.

## Arquitectura

### Android
- WorkManager como scheduler.
- Sync incremental.
- Backoff exponencial.
- Restricción por red cuando corresponda.
- Estado IDLE / RUNNING / SUCCESS / FAILED / AUTH_REQUIRED.
- Sync manual + automático.

### Protocolo
- Idempotencia por syncId + version + deviceId.
- Reintentos seguros.
- Cierre correcto de lotes.
- Detección de sesión expirada.
- Evitar loops de reintento.

### Escalabilidad de sync
- Cursor de cambios.
- Feed incremental.
- Paginación.
- Lotes pequeños.
- Compresión cuando sea útil.

### Tombstones
- No eliminar tombstones arbitrariamente.
- Diseñar garbage collection solamente cuando exista una garantía de reconocimiento de todos los dispositivos relevantes.

## Gate
Dos o más dispositivos deben converger después de edición concurrente, borrado concurrente, desconexión, reconexión, reintentos y sesión expirada.

---

# Fase 21 — Observabilidad y operación

## Objetivo

Poder detectar y diagnosticar problemas sin acceder manualmente a cada servidor.

## Backend
- Logging estructurado JSON.
- Correlation/request ID.
- Métricas de latencia, errores por endpoint, autenticación, sincronización, conflictos, cuotas y billing.
- Health check.
- Readiness check.
- Métricas de base de datos.
- Alertas de error y disponibilidad.

## Android
- Registro local no sensible de fallos de sync.
- Diagnóstico opcional para soporte.
- Nunca registrar contraseñas, tokens, claves privadas ni payloads sensibles innecesarios.

## Gate
Un incidente de API o sync debe poder investigarse usando IDs de correlación y métricas, sin habilitar debug inseguro.

---

# Fase 22 — Escalabilidad de persistencia

## Objetivo

Separar la lógica de negocio de SQLite para poder crecer sin reescribir el dominio.

## Diseño

HTTP → Application Service → Domain → Repository → Database

La aplicación no debe depender de detalles concretos de SQLite.

## Evolución

### Etapa 1
- Mantener SQLite mientras la carga lo permita.
- Añadir índices y consultas eficientes.
- Backup automatizado.

### Etapa 2
- Preparar PostgreSQL como backend principal cuando la carga o concurrencia lo justifique.

### Etapa 3
- Migración controlada.
- Dual-read temporal solamente si es necesario.
- Verificación de integridad.
- Plan de rollback.

## Gate
Cambiar de motor de persistencia no debe requerir cambiar las reglas de negocio, sincronización o autenticación.

---

# Fase 23 — Robustez de API y plataforma

## Objetivo

Convertir el backend en una API de producción resistente a duplicados, abuso y evolución de contratos.

## Componentes
- Idempotency keys para operaciones críticas.
- Rate limiting distribuido.
- Validación estricta de esquemas.
- Versionado explícito de API.
- Deprecation policy.
- Paginación estándar.
- Límites de tamaño.
- ETags/If-None-Match cuando aporten valor.
- Respuestas de error uniformes.
- Protección contra replay donde corresponda.

## Sync
Las operaciones de push deben ser repetibles sin crear duplicados.

## Gate
Reintentar la misma petición no debe producir efectos secundarios duplicados.

---

# Fase 24 — Billing y entitlements de servidor

## Objetivo

Hacer que PRO sea una capacidad verificable por servidor y no simplemente un booleano controlado por el cliente.

## Arquitectura

Google Play → verificación backend → entitlement → workspace/user policy → Android

## Componentes
- Verificación de compra en servidor.
- Persistencia de purchaseToken y estado.
- Idempotencia de eventos de compra.
- Vinculación con usuario autenticado.
- Historial de cambios de entitlement.
- Separación entre producto, compra, entitlement y cuota.

## Seguridad
El APK nunca decide por sí solo quién es PRO.

## Gate
Un usuario no puede obtener PRO modificando almacenamiento local, requests o flags del cliente.

---

# Fase 25 — Privacidad y gobierno de datos

## Objetivo

Definir formalmente qué datos guarda LinkQR, por cuánto tiempo y cómo se eliminan.

## Componentes

### Clasificación
- Datos de cuenta.
- Datos de workspace.
- QR y payload.
- Metadatos de sync.
- Billing.
- Logs técnicos.

### Ciclo de vida
- Creación.
- Retención.
- Exportación.
- Eliminación.
- Revocación.
- Backups y expiración.

### Funciones de usuario
- Exportar datos.
- Eliminar cuenta.
- Eliminar workspace.
- Eliminar registros.

### Principio
La eliminación lógica necesaria para sync no debe convertirse en conservación indefinida de datos.

## Gate
Existe una política técnica coherente entre eliminación lógica, borrado definitivo, backups y obligaciones de privacidad.

---

# Fase 26 — Rendimiento y pruebas de carga

## Objetivo

Medir antes de escalar.

## Android
- Tiempo de arranque.
- Memoria.
- Battery impact.
- Tiempo de generación QR.
- Tiempo de consulta de historial.
- Tiempo de sync.
- Tamaño de base local.

## Backend
Medir RPS, p50/p95/p99, memoria, CPU, conexiones DB, latencia de sync y conflictos por volumen.

## Pruebas
- Load test.
- Stress test.
- Soak test.
- Pruebas de recuperación después de reinicio.

## Gate
Los límites de capacidad deben estar documentados con datos reales, no estimaciones.

---

# Fase 27 — Calidad Android de producción

## Objetivo

Convertir la aplicación técnicamente estable en una aplicación de calidad de distribución amplia.

## Áreas
- Accesibilidad.
- Content descriptions.
- Tamaños de texto.
- Contraste.
- Navegación con teclado.
- TalkBack.
- Diferentes densidades.
- Modo oscuro.
- Idiomas.
- Rotación/configuración.
- Android de gama baja.
- Compatibilidad desde minSdk.
- Estado vacío y estados de error.
- Restauración después de matar el proceso.

## QA
Matriz mínima: Android 12, Android 13, Android 14, Android 15+, dispositivo de gama baja, dispositivo de gama media y emulador.

## Gate
Los flujos principales no dependen de un único tamaño de pantalla o dispositivo.

---

# Fase 28 — Dynamic QR y analítica

Esta fase comienza la expansión fuerte del producto SaaS.

## Objetivo

Permitir que un QR represente un destino administrable en la nube, en lugar de obligar a regenerar la imagen cuando cambia el destino.

## Arquitectura

QR físico → short link estable → resolver backend → destino actual

## Componentes
- Dynamic QR.
- Destino editable.
- Estado activo/inactivo.
- Expiración opcional.
- Historial de destinos.
- Redirect seguro.
- Protección contra open redirects.

## Analítica
- Escaneos.
- Fecha/hora.
- país/región aproximada según configuración.
- dispositivo/categoría.
- referer cuando exista.

No almacenar más información de la necesaria.

## Gate
Cambiar el destino no requiere regenerar el QR físico.

---

# Fase 29 — Administración y soporte

## Objetivo

Operar LinkQR sin acceder directamente a la base de datos.

## Panel administrativo
- Usuarios.
- Workspaces.
- Entitlements.
- Cuotas.
- Sesiones.
- Eventos de seguridad.
- Estado de sincronización.
- Métricas básicas.

## Seguridad administrativa
- Roles.
- RBAC.
- MFA obligatorio.
- Auditoría.
- Separación de credenciales.
- Sin acceso administrativo desde el APK.

## Gate
Las tareas operativas frecuentes deben poder realizarse mediante herramientas administrativas auditables.

---

# Fase 30 — Alta disponibilidad y recuperación

## Objetivo

Preparar LinkQR para fallos de infraestructura sin pérdida de datos ni interrupciones prolongadas.

## Componentes

### Backend
- Múltiples instancias.
- Reverse proxy/load balancer.
- Stateless application layer.
- Gestión central de sesiones.
- Health/readiness probes.

### Datos
- Backups automáticos.
- Point-in-time recovery cuando el motor lo permita.
- Restauración periódicamente probada.
- Réplica/replicación según necesidad.

### Recuperación
- RPO definido.
- RTO definido.
- Runbook de incidentes.
- Simulacro de restauración.

## Gate
Una recuperación desde backup debe estar probada, no solamente documentada.

---

# Arquitectura objetivo

A partir de estas fases, la arquitectura objetivo queda conceptualmente así:

Android App
  └─ Compose + Room + Offline-first
       │
       │ Auth + Sync / HTTPS
       ▼
API Gateway
  └─ TLS / limits / rate limiting
       │
       ▼
Application Services
  ├─ Auth
  ├─ QR
  ├─ Sync
  ├─ Billing
  └─ Analytics
       │
       ├── Identity / Security
       ├── Domain / Policy
       └── Repository Layer
              │
              ▼
       PostgreSQL / SQLite
              │
              ├── Backups
              └── Observability

External systems:
- Google Play Billing
- Email delivery
- Monitoring/metrics
- Object storage/backups

## Reglas arquitectónicas permanentes

1. Offline-first sigue siendo una propiedad del cliente, no una excepción.
2. El cliente nunca es una autoridad de seguridad para PRO, cuotas o permisos.
3. El backend valida toda autorización sensible.
4. La lógica de dominio no depende de Android, Compose, HTTP ni SQLite.
5. Las migraciones deben ser reversibles o tener una estrategia de rollback.
6. Los cambios de sync deben conservar compatibilidad con clientes anteriores cuando sea posible.
7. Los tombstones no se purgan sin una política explícita de reconocimiento.
8. Las operaciones críticas deben ser idempotentes.
9. No introducir microservicios hasta que exista una necesidad operativa demostrable.
10. Cada fase debe cerrar con tests y evidencia CI.

## Dependencias críticas

- F18 bloquea la publicación de producción.
- F19 y F23 deben preceder a una exposición SaaS amplia.
- F20 debe preceder a optimizaciones avanzadas de sync.
- F21 debe preceder a operación seria del backend.
- F22 depende de evidencia de carga; no se migra de motor por moda.
- F24 debe quedar cerrado antes de tratar PRO como entitlement de producción.
- F25 debe coexistir con las decisiones de retención y backup.
- F26 valida las decisiones de escalabilidad de F22/F23.
- F28–F30 solo deben acelerarse después de estabilizar F18–F27.

## Definición de producción

LinkQR podrá considerarse producto 1.0 listo para distribución cuando F18 esté cerrada y todos los requisitos externos de publicación estén cumplidos.

Podrá considerarse SaaS de producción cuando, como mínimo, F19–F25 estén cerradas y exista monitorización, recuperación y pruebas de carga suficientes para el tráfico real esperado.

Las fases 26–30 son evolución de capacidad y producto; no son requisitos para generar y sincronizar QR de forma básica.
