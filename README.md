# ✦ Sala de juegos de ItsTuki ✦

Juegos clásicos para el navegador, con tabla de posiciones global, hechos con HTML, CSS y JavaScript sin dependencias. Corren en **Cloudflare Workers** y los puntajes se guardan en **Cloudflare D1**.

**En vivo:** https://juegos.itstuki.cl

| Juego | Cómo se juega | Tabla de posiciones |
|---|---|---|
| **Snake** | Flechas/WASD o deslizar; espacio para pausar | puntos (10 por estrella) |
| **3 en raya** | Contra la compu (fácil o imposible, con minimax) o de a dos | marcador local |
| **Blackjack** | Apuesta, pide, plántate o dobla. Fichas de juego, sin dinero real | máximo de fichas |
| **2048** | Flechas/WASD o deslizar; con deshacer | puntos |
| **Buscaminas** | Clic para descubrir, clic derecho o mantener presionado para bandera | mejor tiempo (fácil y medio) |

Todo funciona en el celular (controles táctiles y botones en pantalla), tiene tema día/noche y guarda los récords en el navegador. Si la tabla de posiciones no está disponible, los juegos siguen funcionando.

## Úsalo para tu sitio

Puedes copiarlo, cambiarlo y publicarlo como quieras (licencia MIT).

```bash
git clone https://github.com/ItsTuki/itstuki-juegos
cd itstuki-juegos
npm install
npx wrangler login
npx wrangler d1 create itstuki-juegos     # copia el database_id que te entrega
```

En `wrangler.jsonc`:

1. **`database_id`:** pega el valor que te entregó el comando anterior.
2. **`routes`:** cambia la ruta por tu dominio, o bórrala para usar la dirección `*.workers.dev`.
3. **`PAGINA_404`:** pon tu propia página de error, o bórrala para mandar a la portada.

Después publica:

```bash
npx wrangler deploy
```

Las tablas de la base se crean solas la primera vez que alguien abre la tabla de posiciones.

Si usas un subdominio con ruta, crea en Cloudflare un registro DNS con proxy (nube naranja) para él, por ejemplo `A juegos 192.0.2.1`. Como el Worker responde antes, esa IP es solo de relleno.

## Probar en tu computador

```bash
npx wrangler dev                       # http://localhost:8787 con una base D1 local
npx playwright install chromium
node test/e2e-juegos.mjs http://127.0.0.1:8787 capturas
```

## Estructura

```
public/            la sala y los juegos (archivos estáticos)
  index.html       sala, juego activo y panel de posiciones
  juegos.js        núcleo: navegación, récords, controles táctiles, tabla de posiciones
  snake.js · gato.js · blackjack.js · 2048.js · buscaminas.js
  juegos.css · base.css · tema.js
worker/index.js    API de posiciones (D1) y archivos estáticos
wrangler.jsonc     configuración de Cloudflare
test/              prueba de punta a punta con Playwright
```

### Agregar un juego

Crea `public/mijuego.js`, cárgalo en `index.html` antes de `iniciar.js` y regístralo:

```js
Juegos.registrar({
  id: "mijuego", nombre: "Mi juego", descripcion: "…", icono: "★",
  tablas: [{ clave: "mijuego", nombre: "Mi juego", menorEsMejor: false }],
  montar: function (contenedor, api) {
    // … dibuja el juego en contenedor; al terminar:
    api.ofrecerGuardar("mijuego", puntos);
    return function () { /* limpia eventos y temporizadores */ };
  }
});
```

Para que acepte puntajes, agrega su clave con el mínimo y el máximo en `TABLAS` de `worker/index.js`.

## API

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/api/posiciones?juego=snake` | `{ juego, filas: [{ nombre, puntos, fecha }] }`: los 10 mejores, con la mejor marca de cada nombre |
| POST | `/api/puntajes` con `{ juego, nombre, puntos }` | `{ ok, posicion, nombre }` |

**Reglas del servidor:**
- Nombres de 2 a 16 caracteres, solo letras, números, espacio, punto y guiones.
- Puntajes dentro del rango de cada juego.
- Un envío por juego cada 15 segundos por visitante. Se guarda solo una huella de la IP, nunca la IP.

**Importante:** los juegos corren en el navegador, así que alguien con conocimientos puede enviar un puntaje inventado. Los límites de arriba frenan los casos obvios. Para borrar uno a mano:

```bash
npx wrangler d1 execute itstuki-juegos --remote --command "DELETE FROM puntajes WHERE nombre = 'Tramposo'"
```

## Contador de visitas

El pie de la sala muestra un contador de visitas (`/api/visitas`, en `worker/visitas.js`):

- **Qué cuenta:** una visita por persona y día. Si alguien recarga la página o pasa de un sitio a otro el mismo día, cuenta una sola vez.
- **Qué guarda:** solo una huella cifrada de la IP y el navegador. Nunca guarda la IP.
- **Robots:** no se cuentan.
- **Compartirlo:** el contador vive en la misma base D1, así que si otro sitio tuyo usa esa base con el mismo `worker/visitas.js`, ambos comparten la cuenta. Así funciona entre itstuki.cl y juegos.itstuki.cl.

## Licencia

MIT © ItsTuki
