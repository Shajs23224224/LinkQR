# LinkQR — Sincronización SaaS

## Fase 16

La Fase 16 conecta el historial local de LinkQR con el backend SaaS usando la sesión autenticada de la Fase 15.

### Principios

- Room continúa siendo la fuente local para el funcionamiento offline.
- La nube es una réplica opcional del historial.
- La generación, edición visual, historial, favoritos y escáner siguen funcionando sin Internet.
- La sincronización es manual desde **Mi cuenta → Sincronizar QR**.
- El cliente nunca recibe ni almacena la clave administrativa `LINKQR_SAAS_API_KEY`.

### Flujo

1. Android recupera el token cifrado desde Android Keystore.
2. Consulta los espacios de trabajo del usuario.
3. Si no existe ninguno, crea automáticamente **Mi LinkQR** en FREE.
4. Cada registro local obtiene un `remoteRecordId` estable.
5. Los registros locales se envían mediante `POST /v1/saas/workspaces/:workspaceId/qr`.
6. Android vuelve a consultar los registros del espacio mediante `GET /v1/saas/workspaces/:workspaceId/qr`.
7. Los registros remotos que todavía no existen localmente se incorporan a Room.

### Seguridad

- Todas las operaciones SaaS de Android usan `Authorization: Bearer <session-token>`.
- La sesión se almacena localmente cifrada con AES/GCM y Android Keystore.
- El backend aplica aislamiento por `ownerUserId`.
- El plan de un workspace creado desde Android siempre comienza en FREE; el cliente no puede autoasignarse PRO.

### Alcance de esta fase

La Fase 16 implementa sincronización de altas y actualizaciones de registros. La eliminación remota y resolución avanzada de conflictos entre varios dispositivos quedan deliberadamente fuera de esta fase: requieren un modelo de eventos/tombstones y control de versiones para evitar pérdida de datos.

### Offline

Una falla de red deja intacta la base Room. El usuario puede seguir generando QR y trabajar con su historial normalmente y volver a sincronizar cuando disponga de conexión.
