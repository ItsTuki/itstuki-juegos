// Prueba de punta a punta de la sala de juegos.
// Uso: npx wrangler dev --port 8795 &   luego   node test/e2e-juegos.mjs http://127.0.0.1:8795 capturas
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:8795";
const CAPS = process.argv[3] || "capturas";
fs.mkdirSync(CAPS, { recursive: true });
const res = []; let fallas = 0;
const ok = (c, n, d = "") => { res.push((c ? "OK   " : "FALLA") + "  " + n + (d ? "  · " + d : "")); if (!c) fallas++; };

const nav = await chromium.launch();
const errores = [];
async function pagina(opciones) {
  const ctx = await nav.newContext(opciones);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errores.push("JS: " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  return p;
}

// ---------- Computador ----------
const p = await pagina({ viewport: { width: 1366, height: 860 }, colorScheme: "dark" });
await p.goto(BASE + "/");
await p.waitForSelector(".tarjeta-juego");
ok(await p.locator(".tarjeta-juego").count() === 5, "la sala muestra los 5 juegos");
ok(await p.locator("#posiciones-sala .pildoras button").count() === 5, "tabla de posiciones con 5 tablas");
await p.waitForSelector("#posiciones-sala .caja-tabla :is(ol, .tabla-vacia)");
await p.screenshot({ path: CAPS + "/sala.png", fullPage: true });

// Snake
await p.click('a.tarjeta-juego[href="#snake"]');
await p.waitForSelector(".lienzo-snake");
ok(await p.isVisible(".capa-juego"), "snake: pantalla de inicio");
await p.keyboard.press("ArrowUp");
await p.waitForTimeout(300);
ok(await p.isHidden(".capa-juego"), "snake: arranca con una flecha");
await p.keyboard.press(" ");
ok((await p.textContent(".capa-juego b")) === "Pausa", "snake: pausa con espacio");
await p.keyboard.press(" ");
await p.waitForFunction(() => !document.querySelector(".capa-juego").hidden && document.querySelector(".capa-juego b").textContent === "Fin del juego", null, { timeout: 8000 });
ok(true, "snake: termina al chocar con el borde");
await p.screenshot({ path: CAPS + "/snake.png" });
// Formulario de la tabla (puntaje forzado para probar el flujo; se espera el límite de 15 s entre envíos)
await p.waitForTimeout(16000);
await p.evaluate(() => Juegos.api.ofrecerGuardar("snake", 230));
const NOMBRE = "Prueba " + Date.now().toString(36).slice(-5);
await p.fill("#nombre-puntaje", NOMBRE);
await p.click('.guardar-puntaje [type="submit"]');
await p.waitForSelector(".panel-posiciones li.yo", { timeout: 8000 }).catch(() => {});
ok(await p.locator(".panel-posiciones li.yo").count() === 1, "snake: anotar puntaje y verse destacado en la tabla");
await p.screenshot({ path: CAPS + "/snake-tabla.png" });

// 3 en raya: modo 2 jugadores, gana X
await p.click('#nav-juegos a[href="#gato"]');
await p.waitForSelector(".celda-gato");
await p.click('[data-modo="dos"]');
for (const i of [0, 3, 1, 4, 2]) await p.locator(".celda-gato").nth(i).click();
ok((await p.textContent(".estado-juego")).includes("Gana X") && await p.locator(".celda-gato.gana").count() === 3, "3 en raya: detecta al ganador y marca la línea");
await p.click('[data-modo="imposible"]');
await p.locator(".celda-gato").nth(4).click();
await p.waitForFunction(() => document.querySelectorAll(".celda-gato.ficha-o").length === 1, null, { timeout: 3000 });
ok(true, "3 en raya: la compu responde");
await p.screenshot({ path: CAPS + "/gato.png" });

// Blackjack
await p.click('#nav-juegos a[href="#blackjack"]');
await p.waitForSelector(".mesa");
await p.click('text=Repartir');
await p.waitForTimeout(200);
const enJuego = await p.locator("text=Plantarse").count();
if (enJuego) await p.click("text=Plantarse");
await p.waitForFunction(() => /Ganas|Pierdes|Empate|Blackjack|pasó|pasaste/i.test(document.querySelector(".estado-juego").textContent), null, { timeout: 3000 });
ok(await p.locator(".mano").first().locator(".carta").count() >= 2, "blackjack: reparte y resuelve la mano", await p.textContent(".estado-juego"));
await p.screenshot({ path: CAPS + "/blackjack.png" });

// 2048
await p.click('#nav-juegos a[href="#2048"]');
await p.waitForSelector(".ficha-2048");
const antes = await p.evaluate(() => [...document.querySelectorAll(".ficha-2048")].map((f) => f.textContent).join(","));
for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) await p.keyboard.press(k);
const despues = await p.evaluate(() => [...document.querySelectorAll(".ficha-2048")].map((f) => f.textContent).join(","));
ok(antes !== despues && await p.locator(".ficha-2048").count() === 16, "2048: las fichas se mueven con el teclado");
await p.screenshot({ path: CAPS + "/2048.png" });

// Buscaminas
await p.click('#nav-juegos a[href="#buscaminas"]');
await p.waitForSelector(".celda-mina");
await p.locator(".celda-mina").nth(40).click();
ok(await p.locator(".celda-mina.abierta").count() >= 1, "buscaminas: la primera casilla nunca es mina y abre zona", String(await p.locator(".celda-mina.abierta").count()));
const tapada = p.locator(".celda-mina:not(.abierta)").first();
await tapada.click({ button: "right" });
ok(await p.locator(".celda-mina.bandera").count() === 1, "buscaminas: bandera con clic derecho");
await p.click('[data-nivel="medio"]');
ok(await p.locator(".celda-mina").count() === 144 && (await p.getAttribute('.panel-posiciones .pildoras button[aria-pressed="true"]', "aria-pressed")) === "true", "buscaminas: nivel medio 12x12 y su tabla");
await p.screenshot({ path: CAPS + "/buscaminas.png" });

// Tema y volver a la sala
await p.click("#cambiar-tema");
await p.click(".volver");
await p.waitForSelector("#sala:not([hidden])");
ok(true, "volver a la sala");
await p.screenshot({ path: CAPS + "/sala-dia.png", fullPage: true });

// ---------- Celular ----------
const m = await pagina({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true, colorScheme: "dark" });
for (const id of ["", "#snake", "#gato", "#blackjack", "#2048", "#buscaminas"]) {
  await m.goto(BASE + "/" + id);
  await m.waitForSelector(id ? "#juego:not([hidden])" : "#sala:not([hidden])");
  await m.waitForTimeout(250);
  const lateral = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok(!lateral, "celular sin scroll lateral " + (id || "sala"));
  if (id === "#snake" || id === "#2048") {
    const info = await m.evaluate(() => { const c = document.querySelector(".cruceta"); const r = c && c.getBoundingClientRect(); return c ? getComputedStyle(c).display + " " + Math.round(r.width) + "x" + Math.round(r.height) + " hover=" + matchMedia("(hover:hover)").matches : "sin cruceta"; });
    ok(info.startsWith("grid") && !info.includes(" 0x"), "celular: botones de control en " + id, info);
  }
  await m.screenshot({ path: CAPS + "/movil-" + (id.slice(1) || "sala") + ".png", fullPage: true });
}

ok(!errores.length, "sin errores de JS", errores.join(" | "));
await nav.close();
console.log(res.join("\n") + `\n\n${res.length - fallas}/${res.length} pruebas OK`);
process.exit(fallas ? 1 : 0);
