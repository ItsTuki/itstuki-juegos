// Contador de visitas compartido (Cloudflare D1, binding DB).
//   POST /api/visitas → registra la visita de hoy (una por persona y día) y devuelve { total, hoy }
//   GET  /api/visitas → solo devuelve { total, hoy }
// Una "persona" es una huella SHA-256 de IP + navegador + sal: no se guarda la IP ni el navegador.
// itstuki.cl y juegos.itstuki.cl usan la misma base, así que comparten el contador.

const ROBOTS = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|go-http|java\//i;

let esquemaListo = false;
async function preparar(db) {
  if (esquemaListo) return;
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS visitas (dia TEXT NOT NULL, huella TEXT NOT NULL, sitio TEXT NOT NULL, PRIMARY KEY (dia, huella)) WITHOUT ROWID"
  ).run();
  esquemaListo = true;
}

function hoyEnChile() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function huella(request, sal) {
  const texto = (request.headers.get("cf-connecting-ip") || "local") + "|" + (request.headers.get("user-agent") || "") + "|" + sal;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function contar(db, dia) {
  const r = await db.batch([
    db.prepare("SELECT COUNT(*) AS n FROM visitas"),
    db.prepare("SELECT COUNT(*) AS n FROM visitas WHERE dia = ?1").bind(dia),
  ]);
  return { total: r[0].results[0].n, hoy: r[1].results[0].n };
}

export async function visitas(request, env, sitio) {
  const cabeceras = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (!env.DB) return new Response(JSON.stringify({ error: "Contador no configurado." }), { status: 503, headers: cabeceras });
  try {
    await preparar(env.DB);
    const dia = hoyEnChile();
    if (request.method === "POST" && !ROBOTS.test(request.headers.get("user-agent") || "")) {
      const h = await huella(request, env.SAL || "itstuki-visitas");
      await env.DB.prepare("INSERT OR IGNORE INTO visitas (dia, huella, sitio) VALUES (?1, ?2, ?3)").bind(dia, h, sitio).run();
    } else if (request.method !== "GET" && request.method !== "POST") {
      return new Response(null, { status: 405 });
    }
    return new Response(JSON.stringify(await contar(env.DB, dia)), { headers: cabeceras });
  } catch (e) {
    return new Response(JSON.stringify({ error: "No se pudo leer el contador." }), { status: 500, headers: cabeceras });
  }
}
