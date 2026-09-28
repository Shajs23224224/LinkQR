# LinkQR — Autenticación de usuarios

## Fase 14

La autenticación de usuario ya está conectada entre el backend y Android, sin convertirla en un requisito para generar QR offline.

### Funciones

- Registro con correo, contraseña y nombre opcional.
- Inicio de sesión.
- Consulta de la sesión actual.
- Cierre de sesión con revocación en servidor.
- Sesiones opacas con expiración configurable en backend.
- Contraseñas almacenadas mediante scrypt con salt aleatorio.
- Token de sesión almacenado en Android con una clave AES/GCM respaldada por Android Keystore.
- Pantalla de cuenta integrada en la navegación de LinkQR.
- La aplicación sigue funcionando sin iniciar sesión.

### Backend

Activar en el entorno del servidor:

```env
LINKQR_AUTH_ENABLED=true
LINKQR_AUTH_SESSION_DAYS=30
LINKQR_SAAS_ENABLED=true
LINKQR_SAAS_API_KEY=replace-with-server-secret
```

Endpoints:

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`
- `POST /v1/auth/logout`

### Android

El backend de desarrollo puede ejecutarse en `http://10.0.2.2:8080` para el emulador Android.

Para una compilación release:

```bash
./gradlew assembleRelease \
  -PLINKQR_SAAS_BASE_URL=https://api.example.com
```

La aplicación Android nunca recibe `LINKQR_SAAS_API_KEY`.

### Seguridad pendiente

La Fase 14 no incluye todavía verificación de correo, recuperación de contraseña, MFA ni rate limiting distribuido. Esos controles corresponden a fases posteriores antes de un despliegue SaaS abierto a Internet.
