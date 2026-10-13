# LinkQR Web — Fase 10: PWA instalable y uso sin conexión

## Objetivo

Hacer que la web pueda instalarse como aplicación y abrir su shell y recursos estáticos cuando no exista conexión, sin añadir servidor de cuentas ni sincronización.

## Implementación

- Manifiesto `manifest.webmanifest` con nombre, tema, modo standalone, iconos SVG de 192 y 512 px, URL de inicio, ámbito relativo y accesos directos al generador, escáner e historial.
- Registro del service worker con rutas calculadas desde el manifiesto para respetar el prefijo `/LinkQR/` de GitHub Pages y la raíz de desarrollo.
- Caché versionada del shell y los recursos JS/CSS y de los iconos; navegación con estrategia network-first y fallback offline; archivos estáticos con estrategia cache-first.
- Limpieza de cachés antiguas durante la activación. El service worker solo intercepta peticiones GET del mismo origen y dentro de su ámbito.
- Botón de instalación cuando el navegador expone `beforeinstallprompt`, y actualización del indicador de conectividad.
- Página offline estática con enlace para volver al shell.
- No se almacenan en caché las peticiones de cuenta/backend, contenido dinámico ni recursos de otros orígenes.

## Uso y límites

La PWA debe abrirse al menos una vez con conexión para descargar el shell y sus recursos. La instalación y el prompt dependen del navegador; si no se muestra el botón, usa la opción **Instalar aplicación** o **Añadir a pantalla de inicio** del menú del navegador. El escaneo por cámara exige un contexto seguro y permisos, incluso sin conexión.

El service worker guarda recursos de interfaz, no crea una cuenta ni sincroniza el historial. Los QR, favoritos y copias de seguridad continúan almacenados localmente. La caché de aplicación tampoco sustituye a una copia de seguridad exportada.

Para publicar cambios posteriores que alteren el comportamiento del caché, incrementa `CACHE_NAME` en `public/sw.js` para activar una caché nueva y retirar la antigua.

## Verificación

Desde `web/`:

```bash
npm run check
npm test
npm run build
```

Las pruebas revisan el registro del service worker, los estados de instalación y la configuración declarada en el manifiesto.
