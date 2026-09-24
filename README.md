# Kevin Natera · Portafolio

Portafolio interactivo en **pixel art**. Primero ves una habitación de noche: alguien con sudadera y capucha teclea frente a su ordenador mientras llueve. Al hacer **scroll**, la cámara avanza hacia el monitor hasta que la pantalla ocupa toda la vista. Entonces se enciende un **IDE real y navegable** donde cada archivo de `experience/` es uno de mis trabajos.

- Escena 100 % procedural en `<canvas>`, sin imágenes: parallax por capas, luz de borde, lluvia, relámpagos, vapor del café y polvo flotando en la luz.
- Sonido sintetizado con Web Audio API, sin archivos: ambiente de la habitación, lluvia, teclado mecánico sincronizado con la animación, *whoosh* y *riser* durante el zoom, encendido de pantalla y un pad suave en el IDE.
- IDE con explorador, pestañas, resaltado de sintaxis, minimapa, esquema, búsqueda global, historial git (la trayectoria), extensiones (las habilidades), paleta de comandos (`Ctrl+P`) y una terminal con comandos (`help`, `run fandit`, `neofetch`...).
- Responsive, accesible por teclado y compatible con `prefers-reduced-motion` (en ese caso salta directamente al IDE).
- Sin frameworks, sin *build* y sin dependencias: HTML, CSS y JS puros. Las fuentes van en el propio repo, así que no se hacen peticiones a terceros.

## Estructura

```
├── index.html
├── css/
│   ├── fonts.css        # @font-face de las fuentes locales
│   └── style.css        # tema "Dry Dusk", HUD, IDE y responsive
├── js/
│   ├── data.js          # ← TODO el contenido: perfil, experiencias, archivos del IDE
│   ├── highlight.js     # resaltado de sintaxis (ts, dart, php, json, yml, sh, md)
│   ├── font3x5.js       # fuente pixel 3×5 del monitor
│   ├── scene.js         # escena pixel art y cámara
│   ├── audio.js         # diseño sonoro (Web Audio)
│   ├── ide.js           # IDE navegable
│   └── main.js          # arranque, scroll, transiciones
└── assets/
    ├── favicon.svg
    └── fonts/           # Pixelify Sans, Silkscreen, JetBrains Mono (SIL OFL 1.1)
```

## Personalizar

Todo el texto está en **`js/data.js`**:

- `KN.profile`: nombre, email, teléfono, GitHub y LinkedIn.
- `KN.experiences`: los trabajos (empresa, fechas, stack, resumen). Las duraciones se calculan solas.
- `KN.files`: el contenido de cada archivo del IDE. Para añadir un trabajo, crea una entrada en `KN.experiences` y su archivo en `KN.files` con el mismo `file`/`path`.
- `KN.skills`: las "extensiones" (habilidades) con su nivel del 1 al 5.
- `KN.commits`: el historial del panel de control de versiones.
- `KN.sceneCode`: el código que la persona teclea en la escena.

> ⚠️ **Brisa Apps** y **Nodo Digital** son nombres de ejemplo para los dos trabajos de frontend en Venezuela. Cámbialos por los nombres reales antes de publicar.

## Probar en local

Hace falta un servidor local (las fuentes no cargan con `file://` en algunos navegadores):

```bash
python3 -m http.server 8000
# o
npx serve .
```

Luego abre <http://localhost:8000>.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub. Si lo llamas **`<tu-usuario>.github.io`**, la web quedará en `https://<tu-usuario>.github.io`. Con cualquier otro nombre quedará en `https://<tu-usuario>.github.io/<repo>`.
2. Sube los archivos:
   ```bash
   git init
   git add .
   git commit -m "feat: portafolio pixel art"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/<repo>.git
   git push -u origin main
   ```
3. En el repositorio, ve a **Settings → Pages → Build and deployment**, elige *Deploy from a branch*, la rama `main` y la carpeta `/ (root)`, y guarda.
4. En uno o dos minutos la web estará publicada. El archivo `.nojekyll` evita que GitHub procese el sitio con Jekyll.

## Atajos

| Acción | Atajo |
| --- | --- |
| Saltar la intro | `Enter` en la escena |
| Ir a archivo / comandos | `Ctrl/⌘ + P` · `Ctrl/⌘ + Shift + P` |
| Terminal | `Ctrl/⌘ + J` |
| Barra lateral | `Ctrl/⌘ + B` |
| Buscar en todo | `Ctrl/⌘ + Shift + F` |
| Cerrar pestaña | `Alt + W` |

Los enlaces directos también funcionan: `.../#experience/03_fandit.ts` abre ese archivo directamente en el IDE.

## Créditos

- Fuentes: [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), [Silkscreen](https://fonts.google.com/specimen/Silkscreen) y [JetBrains Mono](https://www.jetbrains.com/lp/mono/), bajo licencia SIL Open Font License 1.1.
- Arte, animación y sonido generados por código.
