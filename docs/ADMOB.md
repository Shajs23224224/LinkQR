# LinkQR · AdMob real ads

LinkQR integra tres formatos de Google Mobile Ads:

- Banner adaptable anclado en Home.
- Intersticial cada 3 aperturas del generador, solo para usuarios Free.
- Recompensado opcional: el usuario puede ver un anuncio para obtener 30 minutos sin anuncios.

Durante desarrollo y CI se usan las unidades demo oficiales de Google. Antes de publicar, sustituye los IDs por las unidades creadas en tu cuenta de AdMob.

## Variables de producción

Configura estos valores como **GitHub Actions Secrets** o como propiedades Gradle:

- `LINKQR_ADMOB_APP_ID`
- `LINKQR_ADMOB_BANNER_AD_UNIT_ID`
- `LINKQR_ADMOB_INTERSTITIAL_AD_UNIT_ID`
- `LINKQR_ADMOB_REWARDED_AD_UNIT_ID`

Ejemplo local:

```properties
LINKQR_ADMOB_APP_ID=ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy
LINKQR_ADMOB_BANNER_AD_UNIT_ID=ca-app-pub-xxxxxxxxxxxxxxxx/aaaaaaaaaa
LINKQR_ADMOB_INTERSTITIAL_AD_UNIT_ID=ca-app-pub-xxxxxxxxxxxxxxxx/bbbbbbbbbb
LINKQR_ADMOB_REWARDED_AD_UNIT_ID=ca-app-pub-xxxxxxxxxxxxxxxx/cccccccccc
```

No guardes estos valores en `gradle.properties` versionado si prefieres mantener la configuración fuera del repositorio.

El build de Android conserva IDs demo como fallback para que la CI pueda compilar de forma segura cuando los secretos aún no estén configurados.

## Comportamiento

Los anuncios de pantalla completa se precargan después de que UMP autoriza las solicitudes. Los anuncios se consideran caducados tras 55 minutos y se vuelven a cargar para evitar servir una caché antigua.

El usuario PRO no recibe los formatos publicitarios.

## Referencias oficiales

- https://developers.google.com/admob/android/test-ads
- https://developers.google.com/admob/android/privacy
- https://developers.google.com/admob/android/interstitial
- https://developers.google.com/admob/android/rewarded
