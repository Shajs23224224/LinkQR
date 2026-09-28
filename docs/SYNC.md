# LinkQR — Sincronización SaaS

## Fase 16

La Fase 16 conecta el historial local de LinkQR con el backend SaaS usando la sesión autenticada de la Fase 15.

### Principios

- Room continúa siendo la fuente local para el funcionamiento offline.
- La nube es una réplica opcional del historial.
- Generación, historial, favoritos y escáner siguen funcionando sin Internet.
- La sincronización es manual desde **Mi cuenta → Sincronizar QR**.
- El cliente nunca recibe ni almacena la clave administrativa `LINKQR_SAAS_API_KEY`.

### Identidad y estado de sincronización

Cada registro local mantiene:

- `remoteRecordId`: identidad estable en la nube.
- `remoteVersion`: versión conocida del servidor.
- `updatedAt`: instante de la última modificación local/remota.
- `syncDirty`: indica que existe una modificación local pendiente.
- `deletedAt`: tombstone local cuando un QR sincronizado fue eliminado.

### Flujo

1. Android recupera el token cifrado desde Android Keystore.
2. Consulta el primer workspace del usuario o crea automáticamente **Mi LinkQR** en FREE.
3. Solo los registros marcados como dirty se envían al backend.
4. Cada mutación incluye `baseVersion` y `updatedAt`.
5. El backend incrementa `version` cuando acepta una mutación.
6. Las eliminaciones se representan como tombstones y no se eliminan físicamente del servidor.
7. Android consulta `GET /v1/saas/workspaces/:workspaceId/qr/sync`, que incluye registros activos y tombstones.
8. Los cambios remotos con una versión superior actualizan Room.
9. Los tombstones remotos eliminan lógicamente el registro local para impedir que reaparezca.

### Resolución de conflictos

La Fase 16 usa control de versión optimista y una política determinista **last-write-wins** basada en `updatedAt`:

- Si `baseVersion` coincide con la versión del servidor, la mutación se acepta.
- Si la versión está desactualizada pero el `updatedAt` recibido es posterior al del servidor, se acepta la modificación más reciente.
- Si la modificación recibida es anterior o igual, el backend devuelve `SYNC_CONFLICT` con el estado ganador.
- Android aplica automáticamente el estado ganador y elimina el dirty local.

Esto evita que un dispositivo antiguo sobrescriba silenciosamente un cambio más reciente.

### Eliminaciones

Una eliminación local de un QR previamente sincronizado crea un tombstone local y posteriormente uno remoto.

Los tombstones:

- no cuentan contra la cuota FREE/PRO;
- se entregan durante la sincronización;
- evitan que un dispositivo offline vuelva a subir un QR eliminado;
- permiten propagar eliminaciones entre dispositivos.

Los registros creados y eliminados antes de la primera sincronización se pueden eliminar físicamente del dispositivo porque todavía no tienen identidad remota.

### Seguridad

- Todas las operaciones SaaS de Android usan `Authorization: Bearer <session-token>`.
- La sesión se almacena localmente cifrada con AES/GCM y Android Keystore.
- El backend aplica aislamiento por `ownerUserId`.
- El plan de un workspace creado desde Android siempre comienza en FREE.

### Limitaciones conocidas

La política LWW depende del reloj del dispositivo para comparar `updatedAt`. En una futura versión de sincronización se puede sustituir por un reloj lógico/eventos de servidor si se necesita una semántica más estricta.

### Endpoints de sincronización

- `POST /v1/saas/workspaces/:workspaceId/qr`
- `DELETE /v1/saas/workspaces/:workspaceId/qr/:recordId`
- `GET /v1/saas/workspaces/:workspaceId/qr/sync`

### Offline

Una falla de red no borra cambios locales ni bloquea la generación de QR. Las mutaciones quedan marcadas como dirty y vuelven a intentarse en la siguiente sincronización.
