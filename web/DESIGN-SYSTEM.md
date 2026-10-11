# LinkQR Web — Fase 3: sistema visual responsive

## Objetivo

Definir una base visual coherente y reutilizable para LinkQR Web antes de implementar navegación, generación QR y conexión con servicios. La pantalla actual es una muestra del sistema visual; no es todavía el panel funcional del producto.

## Dirección visual

- **Marca:** índigo como color de acción; tinta oscura para lectura; superficies blancas sobre fondo gris muy claro.
- **Tipografía:** pila de sistema, sin descarga de fuentes ni dependencia de CDN.
- **Forma:** esquinas redondeadas moderadas, bordes sutiles y sombras reservadas para elevar superficies.
- **Densidad:** espacios generosos en introducciones; componentes compactos y alineados en controles.
- **Elemento QR:** contraste alto y área de respiro. El patrón de la página es una ilustración decorativa y explícitamente no escaneable.

## Tokens CSS

Los tokens se centralizan en `:root` de `src/styles.css`:

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-brand` | `#4F46E5` | Acciones principales y énfasis |
| `--color-ink` | `#111827` | Texto principal |
| `--color-muted` | `#6B7280` | Texto secundario |
| `--color-border` | `#E5E7EB` | Divisores y límites |
| `--color-page` | `#F8F9FC` | Fondo general |
| `--color-surface` | `#FFFFFF` | Tarjetas y controles |
| `--color-success` | `#15803D` | Confirmación positiva |
| `--color-warning` | `#A16207` | Atención necesaria |
| `--radius-small` | `0.625rem` | Campos y botones |
| `--radius-medium` | `1rem` | Controles compuestos |
| `--radius-large` | `1.375rem` | Paneles principales |

## Componentes de base

- **Botones:** primario, secundario y discreto; altura mínima de 44 px; estados hover/active/focus.
- **Campos:** etiqueta externa persistente, foco visible y texto de ayuda.
- **Estados:** badges de listo, borrador y revisión. El significado se expresa con color y texto/símbolo.
- **Paneles:** borde y elevación uniforme con encabezados y separación consistentes.
- **Muestra QR:** marco limpio, área de descanso y metadato explicativo.

## Responsive

- Base de diseño móvil desde 320 px.
- Una columna por debajo de 760 px; dos columnas para los paneles principales en pantallas mayores.
- Panel de componentes ocupa el ancho completo en escritorio.
- Ajustes específicos por debajo de 420 px para botones, cabecera y muestra QR.
- Controles con zonas táctiles de al menos 44 px cuando aplica.

## Accesibilidad y rendimiento

- HTML semántico con cabecera, contenido principal, secciones tituladas y pie.
- Enlace para saltar directamente al contenido.
- Anillo de foco visible para controles que se operan con teclado.
- Mensajes de demostración en una región `role=status` con `aria-live=polite`.
- Respeto a `prefers-reduced-motion`.
- Contrastes definidos como base visual; deberán medirse formalmente antes del lanzamiento.
- Sin paquetes de runtime, bibliotecas externas ni llamadas de red en esta fase.

## Validación y límites

Esta fase entrega el sistema visual y una página demostrativa. Las pruebas automatizadas de navegador, validación formal WCAG, navegación real, QR funcional, autenticación y sincronización no forman parte de este alcance. El patrón QR mostrado no representa un código válido.

## Ejecución local

Desde `web/`:

```bash
npm run dev
npm run check
```

Después abre http://localhost:4173. El servidor estático permite verificar la página, pero no sustituye pruebas en varios navegadores/dispositivos.
