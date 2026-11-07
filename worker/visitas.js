// Contador de visitantes totales (Cloudflare D1, binding DB). Compartido entre itstuki.cl y juegos.itstuki.cl.
//   POST /api/visitas → registra al visitante (una sola vez para siempre) y devuelve { total }
//   GET  /api/visitas → solo devuelve { total } (lo usa la página para actualizarse en vivo)
//
// Cómo se reconoce a una persona:
//   1. Cookie "itv" con un identificador, válida para todo el dominio (DOMINIO_COOKIE, p. ej. itstuki.cl),
//      así quien pasa de itstuki.cl a juegos.itstuki.cl cuenta una sola vez.
//   2. Si no trae cookie, una huella SHA-256 de IP + navegador + sal (no se guarda la IP), que además
//      se le entrega como cookie para reconocerla aunque cambie de red.
// El total vive en una fila propia, así cada consulta lee una sola fila.

const ROBOTS = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|go-http|java\//i;
const COOKIE = "itv";

let esquemaListo = false;
async function preparar(db) {
  if (esquemaListo) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS visitantes (id TEXT PRIMARY KEY, primera INTEGER NOT NULL, sitio TEXT NOT NULL) WITHOUT ROWID"),
    db.prepare("CREATE TABLE IF NOT EXISTS contadores (clave TEXT PRIMARY KEY, valor INTEGER NOT NULL) WITHOUT ROWID"),
  ]);
  const fila = await db.prepare("SELECT valor FROM contadores WHERE clave = 'visitantes'").first();
  if (!fila) {
    // Primera vez: trae a los visitantes del contador anterior (por día), si existía
    const anterior = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'visitas'").first();
    if (anterior) {
      await db.prepare(
        "INSERT OR IGNORE INTO visitantes (id, primera, sitio) SELECT huella, CAST(strftime('%s', MIN(dia)) AS INTEGER) * 1000, MIN(sitio) FROM visitas GROUP BY huella"
      ).run();
    }
    await db.prepare("INSERT OR IGNORE INTO contadores (clave, valor) SELECT 'visitantes', COUNT(*) FROM visitantes").run();
  }
  esquemaListo = true;
}

async function huella(request, sal) {
  const texto = (request.headers.get("cf-connecting-ip") || "local") + "|" + (request.headers.get("user-agent") || "") + "|" + sal;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function leerCookie(request) {
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)itv=([a-f0-9]{24})(?:;|$)/);
  return m ? m[1] : null;
}

function cookie(id, url, env) {
  const dominio = env.DOMINIO_COOKIE;
  const usarDominio = dominio && (url.hostname === dominio || url.hostname.endsWith("." + dominio));
  return [
    `${COOKIE}=${id}`, "Path=/", "Max-Age=63072000", "SameSite=Lax", "HttpOnly",
    url.protocol === "https:" ? "Secure" : null,
    usarDominio ? `Domain=${dominio}` : null,
  ].filter(Boolean).join("; ");
}

async function total(db) {
  const f = await db.prepare("SELECT valor FROM contadores WHERE clave = 'visitantes'").first();
  return f ? f.valor : 0;
}

export async function visitas(request, env, sitio) {
  const url = new URL(request.url);
  const cabeceras = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  if (!env.DB) return new Response(JSON.stringify({ error: "Contador no configurado." }), { status: 503, headers: cabeceras });
  if (request.method !== "GET" && request.method !== "POST") return new Response(null, { status: 405 });
  try {
    await preparar(env.DB);
    let nuevo = false;
    if (request.method === "POST" && !ROBOTS.test(request.headers.get("user-agent") || "")) {
      const id = leerCookie(request) || (await huella(request, env.SAL || "itstuki-visitas"));
      const r = await env.DB.prepare("INSERT OR IGNORE INTO visitantes (id, primera, sitio) VALUES (?1, ?2, ?3)").bind(id, Date.now(), sitio).run();
      if (r.meta && r.meta.changes > 0) {
        await env.DB.prepare("UPDATE contadores SET valor = valor + 1 WHERE clave = 'visitantes'").run();
        nuevo = true;
      }
      cabeceras.append("set-cookie", cookie(id, url, env));
    }
    return new Response(JSON.stringify({ total: await total(env.DB), nuevo }), { headers: cabeceras });
  } catch (e) {
    return new Response(JSON.stringify({ error: "No se pudo leer el contador." }), { status: 500, headers: cabeceras });
  }
}
