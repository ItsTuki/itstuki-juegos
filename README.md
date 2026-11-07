# ✦ Sala de juegos de ItsTuki ✦

Juegos clásicos para el navegador, con tabla de posiciones global, hechos con HTML, CSS y JavaScript sin dependencias. Corren en **Cloudflare Workers** y los puntajes se guardan en **Cloudflare D1**.

**En vivo:** https://juegos.itstuki.cl

| Juego | Cómo se juega | Tabla de posiciones |
|---|---|---|
| **Snake** | Flechas/WASD o deslizar; espacio para pausar | puntos (10 por estrella) |
| **3 en raya** | Contra la compu (fácil o imposible, con minimax) o de a dos | marcador local |
| **Blackjack** | Apuesta, pide, plántate o dobla. Con TukiPoints, sin dinero real | máximo de TukiPoints |
| **Ruleta** | Ruleta europea: plenos, colores, par/impar, mitades y docenas. Con TukiPoints | máximo de TukiPoints |
| **2048** | Flechas/WASD o deslizar; con deshacer | puntos |
| **Buscaminas** | Clic para descubrir, clic derecho o mantener presionado para bandera | mejor tiempo (fácil y medio) |

**TukiPoints** es la moneda de la sala: un solo saldo para Blackjack y Ruleta, guardado en el navegador (`api.tukipoints`). Se empieza con 1.000 y se puede recargar al quedar en cero. No hay dinero real.

**Sonido:** música chiptune original y efectos para cada juego, generados en el navegador con Web Audio (`public/sonido.js`, sin archivos de audio). La música empieza apagada; los botones 🎵 y 🔊 de la barra la encienden y silencian los efectos, y el navegador recuerda la elección. Los juegos usan `api.sonido.efecto("nombre")`.

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
  snake.js · gato.js · blackjack.js · ruleta.js · 2048.js · buscaminas.js
  sonido.js        música y efectos (Web Audio)
  juegos.css · base.css · tema.js
worker/index.js    API de posiciones (D1) y archivos estáticos
worker/filtro.js   filtro de nombres groseros
wrangler.jsonc     configuración de Cloudflare
test/              prueba de punta a punta con Playwright y prueba del filtro
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
- Sin nombres groseros (`worker/filtro.js`, en español de Chile y en inglés). Se rechazan al anotar y los que ya estaban guardados no se muestran. Para agregar palabras, edita las listas del archivo y corre `node test/filtro.mjs`.
- Puntajes dentro del rango de cada juego.
- Un envío por juego cada 15 segundos por visitante. Se guarda solo una huella de la IP, nunca la IP.

**Importante:** los juegos corren en el navegador, así que alguien con conocimientos puede enviar un puntaje inventado. Los límites de arriba frenan los casos obvios. Para borrar uno a mano:

```bash
npx wrangler d1 execute itstuki-juegos --remote --command "DELETE FROM puntajes WHERE nombre = 'Tramposo'"
```

## Contador de visitantes

El pie de la sala muestra cuántas personas han visitado el sitio en total (`/api/visitas`, en `worker/visitas.js`).

- **Una vez para siempre:** cada persona cuenta una sola vez.
- **Cómo la reconoce:** con una cookie válida para todo el dominio (`DOMINIO_COOKIE`). Si no trae cookie, usa una huella cifrada de la IP y el navegador; nunca guarda la IP.
- **Robots:** no se cuentan.
- **En vivo:** la página consulta el total cada 8 segundos mientras está a la vista, y los dígitos giran cuando llega alguien nuevo.
- **Compartido:** si otro sitio tuyo usa la misma base D1 con el mismo `worker/visitas.js` y el mismo `DOMINIO_COOKIE`, ambos comparten la cuenta. Así funciona entre itstuki.cl y juegos.itstuki.cl.

## Licencia

MIT © ItsTuki
