// Worker de la sala de juegos
// - Sirve public/ como archivos estáticos.
// - API de la tabla de posiciones en D1 (binding DB):
//     GET  /api/posiciones?juego=snake   → { juego, filas: [{ nombre, puntos, fecha }] }  (top 10, mejor marca por nombre)
//     POST /api/puntajes { juego, nombre, puntos } → { ok, posicion, nombre }
// - Si no hay base de datos configurada, la API responde 503 y la sala sigue funcionando con récords locales.
// - Toda dirección que no exista redirige a PAGINA_404 (o a la portada si no está definida).

// Límites por tabla: evitan puntajes imposibles. "menor" = menos es mejor (tiempos).
const TABLAS = {
  snake: { min: 10, max: 4000, menor: false },
  "2048": { min: 4, max: 4000000, menor: false },
  blackjack: { min: 1001, max: 100000000, menor: false },
  "buscaminas-facil": { min: 1, max: 9999, menor: true },
  "buscaminas-medio": { min: 3, max: 9999, menor: true },
};

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS puntajes (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     juego TEXT NOT NULL,
     nombre TEXT NOT NULL,
     puntos INTEGER NOT NULL,
     creado INTEGER NOT NULL,
     origen TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_puntajes_juego ON puntajes (juego, puntos)`,
  `CREATE INDEX IF NOT EXISTS idx_puntajes_origen ON puntajes (origen, juego, creado)`,
];

let esquemaListo = false;
async function prepararEsquema(db) {
  if (esquemaListo) return;
  await db.batch(ESQUEMA.map((sql) => db.prepare(sql)));
  esquemaListo = true;
}

function json(datos, estado = 200, extra = {}) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

// Nombre visible: 2 a 16 caracteres; letras (con tildes), números, espacio, punto, guion y guion bajo.
function limpiarNombre(texto) {
  const n = String(texto || "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} ._\-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  return n.length >= 2 ? n : null;
}

async function huella(texto) {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function top(db, juego) {
  const def = TABLAS[juego];
  const agregado = def.menor ? "MIN(puntos)" : "MAX(puntos)";
  const orden = def.menor ? "ASC" : "DESC";
  const { results } = await db
    .prepare(
      `SELECT nombre, ${agregado} AS puntos, MIN(creado) AS fecha FROM puntajes
       WHERE juego = ?1 GROUP BY nombre COLLATE NOCASE ORDER BY puntos ${orden}, fecha ASC LIMIT 10`
    )
    .bind(juego)
    .all();
  return results.map((f) => ({ nombre: f.nombre, puntos: f.puntos, fecha: new Date(f.fecha).toISOString().slice(0, 10) }));
}

async function api(request, url, env) {
  if (!env.DB) return json({ error: "La tabla de posiciones no está configurada." }, 503);
  await prepararEsquema(env.DB);

  if (url.pathname === "/api/posiciones" && request.method === "GET") {
    const juego = url.searchParams.get("juego") || "";
    if (!TABLAS[juego]) return json({ error: "Juego desconocido." }, 400);
    return json({ juego, filas: await top(env.DB, juego) }, 200, { "cache-control": "public, max-age=10" });
  }

  if (url.pathname === "/api/puntajes" && request.method === "POST") {
    let cuerpo;
    try { cuerpo = await request.json(); } catch { return json({ error: "Datos inválidos." }, 400); }
    const juego = String(cuerpo.juego || "");
    const def = TABLAS[juego];
    if (!def) return json({ error: "Juego desconocido." }, 400);
    const nombre = limpiarNombre(cuerpo.nombre);
    if (!nombre) return json({ error: "El nombre debe tener entre 2 y 16 letras o números." }, 400);
    const puntos = Number(cuerpo.puntos);
    if (!Number.isInteger(puntos) || puntos < def.min || puntos > def.max) return json({ error: "Ese puntaje no es válido." }, 400);

    // Un envío por juego cada 15 segundos por visitante (huella de la IP, no se guarda la IP).
    const ahora = Date.now();
    const origen = await huella((request.headers.get("cf-connecting-ip") || "local") + "|" + (env.SAL || "itstuki-juegos"));
    const reciente = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM puntajes WHERE origen = ?1 AND juego = ?2 AND creado > ?3")
      .bind(origen, juego, ahora - 15000)
      .first();
    if (reciente && reciente.n > 0) return json({ error: "Espera unos segundos antes de anotar otro puntaje." }, 429);

    await env.DB.prepare("INSERT INTO puntajes (juego, nombre, puntos, creado, origen) VALUES (?1, ?2, ?3, ?4, ?5)")
      .bind(juego, nombre, puntos, ahora, origen)
      .run();

    const filas = await top(env.DB, juego);
    const i = filas.findIndex((f) => f.nombre.toLowerCase() === nombre.toLowerCase() && f.puntos === puntos);
    return json({ ok: true, nombre, posicion: i >= 0 ? i + 1 : null });
  }

  return json({ error: "No encontrado." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(request, url, env);
      } catch (e) {
        return json({ error: "Error del servidor." }, 500);
      }
    }
    const respuesta = await env.ASSETS.fetch(request);
    if (respuesta.status === 404) return Response.redirect(env.PAGINA_404 || new URL("/", url).toString(), 302);
    return respuesta;
  },
};
