/* ItsTuki · sonido
   Música chiptune y efectos hechos con Web Audio: no hay archivos de audio, todo se genera en el
   navegador. Las melodías son originales de ItsTuki.
   Uso:
     Sonido.efecto("moneda")                 → reproduce un efecto (si los efectos están activos)
     Sonido.cancion("sala" | "casita")       → elige la canción de la página
     Sonido.botones(contenedor, antesDe)     → agrega los botones 🎵 música y 🔊 efectos
   Preferencias en localStorage ("sonido:musica", "sonido:efectos"). La música empieza apagada y
   los navegadores no dejan que suene sola: arranca con el botón (o con el primer toque si ya se había
   activado antes). Este mismo archivo está en itstuki.cl y en juegos.itstuki.cl. */
var Sonido = (function(){
  "use strict";
  var Contexto = window.AudioContext || window.webkitAudioContext;
  var ctx = null, salida = null, busMusica = null, busEfectos = null, ruidoBuf = null;
  var VOL_MUSICA = 0.16, VOL_EFECTOS = 0.32;

  function leer(k, d){ try { var v = localStorage.getItem("sonido:" + k); return v === null ? d : v === "1"; } catch (e) { return d; } }
  function guardar(k, v){ try { localStorage.setItem("sonido:" + k, v ? "1" : "0"); } catch (e) {} }
  var pref = { musica: leer("musica", false), efectos: leer("efectos", true) };
  var cancionActual = "sala", gestoHecho = false;

  function asegurar(){
    if (!Contexto) return null;
    if (!ctx){
      try { ctx = new Contexto(); } catch (e) { return null; }
      salida = ctx.createDynamicsCompressor(); salida.connect(ctx.destination);
      busMusica = ctx.createGain(); busMusica.gain.value = VOL_MUSICA; busMusica.connect(salida);
      busEfectos = ctx.createGain(); busEfectos.gain.value = VOL_EFECTOS; busEfectos.connect(salida);
      ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = ruidoBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended" && gestoHecho && !document.hidden) ctx.resume().catch(function(){});
    return ctx;
  }
  function hz(midi){ return 440 * Math.pow(2, (midi - 69) / 12); }

  /* ---------- Instrumentos básicos ---------- */
  // Tono con envolvente: tipo de onda, frecuencia (o deslizamiento a "hasta"), volumen y duración
  function tono(bus, t, o){
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.tipo || "square";
    osc.frequency.setValueAtTime(o.f, t);
    if (o.hasta) osc.frequency.exponentialRampToValueAtTime(o.hasta, t + o.dur);
    var vol = o.vol === undefined ? 0.3 : o.vol, ataque = o.ataque || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); g.connect(bus);
    osc.start(t); osc.stop(t + o.dur + 0.02);
  }
  // Ruido filtrado (golpes, cartas, platillos, explosiones)
  function ruido(bus, t, o){
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = ruidoBuf;
    f.type = o.filtro || "lowpass"; f.frequency.setValueAtTime(o.f || 2000, t);
    if (o.hasta) f.frequency.exponentialRampToValueAtTime(o.hasta, t + o.dur);
    g.gain.setValueAtTime(o.vol === undefined ? 0.3 : o.vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.02);
  }
  function arpegio(t, notas, paso, tipo, vol){
    notas.forEach(function(n, i){ tono(busEfectos, t + i * paso, { tipo: tipo || "square", f: hz(n), dur: paso * 1.6, vol: vol || 0.22 }); });
  }

  /* ---------- Efectos ---------- */
  var E = {
    clic: function(t){ tono(busEfectos, t, { f: 900, hasta: 650, dur: 0.045, vol: 0.12 }); },
    pop: function(t){ tono(busEfectos, t, { tipo: "sine", f: 420, hasta: 880, dur: 0.09, vol: 0.35 }); },
    moneda: function(t){ tono(busEfectos, t, { f: hz(83), dur: 0.07, vol: 0.2 }); tono(busEfectos, t + 0.07, { f: hz(88), dur: 0.22, vol: 0.2 }); },
    ficha: function(t){ tono(busEfectos, t, { tipo: "triangle", f: 2300, dur: 0.05, vol: 0.25 }); tono(busEfectos, t + 0.035, { tipo: "triangle", f: 3150, dur: 0.06, vol: 0.18 }); },
    carta: function(t){ ruido(busEfectos, t, { filtro: "bandpass", f: 3200, hasta: 1500, dur: 0.09, vol: 0.5 }); },
    tick: function(t, fuerza){ tono(busEfectos, t, { f: 1700, dur: 0.018, vol: 0.05 + 0.07 * (fuerza === undefined ? 1 : fuerza) }); },
    bola: function(t, fuerza){ var v = fuerza === undefined ? 1 : fuerza; tono(busEfectos, t, { tipo: "triangle", f: 1300, hasta: 850, dur: 0.06, vol: 0.12 + 0.2 * v }); },
    cae: function(t){ tono(busEfectos, t, { tipo: "triangle", f: 900, hasta: 500, dur: 0.12, vol: 0.3 }); ruido(busEfectos, t, { f: 1800, dur: 0.06, vol: 0.15 }); },
    ganar: function(t){ arpegio(t, [72, 76, 79, 84], 0.085); },
    grande: function(t){ arpegio(t, [72, 76, 79, 84, 88, 91, 96], 0.07, "square", 0.2); tono(busEfectos, t + 0.5, { tipo: "triangle", f: hz(84), dur: 0.5, vol: 0.25 }); },
    perder: function(t){ tono(busEfectos, t, { tipo: "triangle", f: hz(67), hasta: hz(60), dur: 0.22, vol: 0.3 }); tono(busEfectos, t + 0.2, { tipo: "triangle", f: hz(63), hasta: hz(55), dur: 0.38, vol: 0.3 }); },
    empate: function(t){ tono(busEfectos, t, { tipo: "triangle", f: hz(72), dur: 0.12, vol: 0.25 }); tono(busEfectos, t + 0.14, { tipo: "triangle", f: hz(72), dur: 0.16, vol: 0.25 }); },
    record: function(t){ arpegio(t, [67, 72, 76, 79], 0.09); arpegio(t + 0.38, [84], 0.4, "square", 0.22); arpegio(t + 0.38, [76], 0.4, "triangle", 0.18); },
    comer: function(t){ tono(busEfectos, t, { f: 440, hasta: 990, dur: 0.07, vol: 0.18 }); },
    morir: function(t){ tono(busEfectos, t, { f: 440, hasta: 70, dur: 0.55, vol: 0.22 }); ruido(busEfectos, t + 0.05, { f: 900, hasta: 120, dur: 0.4, vol: 0.25 }); },
    mover: function(t){ ruido(busEfectos, t, { filtro: "bandpass", f: 900, hasta: 2200, dur: 0.07, vol: 0.18 }); },
    unir: function(t, valor){ var n = Math.log2(valor || 4); tono(busEfectos, t, { tipo: "sine", f: 260 + n * 70, hasta: 380 + n * 90, dur: 0.1, vol: 0.32 }); },
    abrir: function(t){ tono(busEfectos, t, { tipo: "triangle", f: 700, hasta: 950, dur: 0.04, vol: 0.2 }); },
    bandera: function(t){ tono(busEfectos, t, { f: hz(84), dur: 0.05, vol: 0.14 }); tono(busEfectos, t + 0.05, { f: hz(91), dur: 0.07, vol: 0.14 }); },
    boom: function(t){ ruido(busEfectos, t, { f: 1600, hasta: 80, dur: 0.9, vol: 0.7 }); tono(busEfectos, t, { tipo: "sine", f: 120, hasta: 35, dur: 0.6, vol: 0.6 }); },
    error: function(t){ tono(busEfectos, t, { f: 196, dur: 0.14, vol: 0.14 }); }
  };
  var ultimoEfecto = {};
  function efecto(nombre, arg){
    if (!pref.efectos || !E[nombre] || !gestoHecho) return;
    if (!asegurar() || ctx.state !== "running") return;
    // Evita amontonar el mismo efecto (por ejemplo, muchas casillas abiertas a la vez)
    var ahora = ctx.currentTime;
    if (ultimoEfecto[nombre] && ahora - ultimoEfecto[nombre] < 0.025) return;
    ultimoEfecto[nombre] = ahora;
    try { E[nombre](ahora + 0.005, arg); } catch (e) {}
  }

  /* ---------- Música ----------
     Cada canción tiene acordes (uno por compás), melodía [paso, nota MIDI, largo en pasos] por compás,
     bajo y batería. Un compás son 8 pasos (corcheas). */
  var CANCIONES = {
    // Para la sala de juegos: movida, en Do mayor
    sala: {
      bpm: 126, lead: "square", volLead: 0.16, pad: false,
      acordes: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50], [48, 52, 55], [45, 48, 52], [38, 41, 45], [43, 47, 50]],
      melodia: [
        [[0, 72, 1], [2, 76, 1], [3, 79, 1], [4, 76, 1], [6, 74, 1], [7, 72, 1]],
        [[0, 69, 1], [2, 72, 1], [3, 76, 1], [4, 74, 1], [5, 72, 1], [7, 69, 1]],
        [[0, 65, 1], [1, 69, 1], [2, 72, 2], [4, 77, 1], [5, 76, 1], [6, 74, 1], [7, 72, 1]],
        [[0, 71, 2], [2, 74, 2], [4, 79, 2], [6, 77, 1], [7, 74, 1]],
        [[0, 72, 1], [1, 76, 1], [2, 79, 1], [3, 84, 1], [4, 83, 1], [5, 79, 1], [6, 76, 2]],
        [[0, 81, 2], [2, 79, 1], [3, 76, 1], [4, 77, 1], [5, 76, 1], [6, 74, 1], [7, 72, 1]],
        [[0, 74, 2], [2, 77, 1], [3, 81, 1], [4, 79, 1], [5, 77, 1], [6, 76, 1], [7, 74, 1]],
        [[0, 71, 1], [1, 74, 1], [2, 77, 1], [3, 79, 1], [4, 74, 2], [6, 71, 2]]
      ],
      bajo: [[0, 0], [2, 12], [4, 0], [6, 12]],
      bombo: [0, 4], caja: [2, 6], platillo: [0, 1, 2, 3, 4, 5, 6, 7]
    },
    // Para el portafolio: tranquila, acordes con séptima en Fa
    casita: {
      bpm: 84, lead: "triangle", volLead: 0.24, pad: true, ganancia: 2,
      acordes: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59], [46, 50, 53, 57], [45, 48, 52, 55], [43, 46, 50, 53], [48, 52, 55, 58]],
      melodia: [
        [[0, 72, 2], [2, 76, 2], [4, 77, 3], [7, 76, 1]],
        [[0, 74, 4], [4, 71, 2], [6, 72, 2]],
        [[0, 69, 2], [2, 72, 2], [4, 77, 2], [6, 76, 2]],
        [[0, 74, 3], [3, 72, 1], [4, 67, 4]],
        [[0, 74, 2], [2, 77, 2], [4, 81, 3], [7, 79, 1]],
        [[0, 76, 4], [4, 72, 2], [6, 74, 2]],
        [[0, 74, 2], [2, 70, 2], [4, 72, 2], [6, 74, 2]],
        [[0, 76, 6]]
      ],
      bajo: [[0, 0], [5, 0]],
      bombo: [0, 5], caja: [4], platillo: [2, 6]
    }
  };

  var reloj = null, siguiente = 0, paso = 0, sonando = false;
  function programarPaso(c, t, p){
    var compas = Math.floor(p / 8) % c.acordes.length, s = p % 8, dur = 60 / c.bpm / 2, acorde = c.acordes[compas], k = c.ganancia || 1;
    c.melodia[compas].forEach(function(n){
      if (n[0] === s) tono(busMusica, t, { tipo: c.lead, f: hz(n[1]), dur: dur * n[2] * 0.95, vol: (c.volLead) * k, ataque: c.pad ? 0.03 : 0.004 });
    });
    c.bajo.forEach(function(b){ if (b[0] === s) tono(busMusica, t, { tipo: "triangle", f: hz(acorde[0] - 12 + b[1]), dur: dur * 1.8, vol: (0.32) * k }); });
    if (c.pad && s === 0) acorde.forEach(function(n){ tono(busMusica, t, { tipo: "sine", f: hz(n), dur: dur * 8, vol: (0.07) * k, ataque: 0.25 }); });
    if (!c.pad && (s === 1 || s === 5)) acorde.forEach(function(n, i){ tono(busMusica, t + i * dur / 4, { tipo: "square", f: hz(n + 12), dur: dur * 0.3, vol: (0.035) * k }); });
    if (c.bombo.indexOf(s) >= 0) tono(busMusica, t, { tipo: "sine", f: 150, hasta: 45, dur: 0.16, vol: (0.55) * k });
    if (c.caja.indexOf(s) >= 0) ruido(busMusica, t, { filtro: c.pad ? "lowpass" : "highpass", f: c.pad ? 2500 : 1500, dur: c.pad ? 0.16 : 0.12, vol: (c.pad ? 0.18 : 0.25) * k });
    if (c.platillo.indexOf(s) >= 0) ruido(busMusica, t, { filtro: "highpass", f: 7000, dur: 0.035, vol: (c.pad ? 0.05 : 0.07) * k });
  }
  function programador(){
    var c = CANCIONES[cancionActual];
    while (siguiente < ctx.currentTime + 0.15){
      programarPaso(c, siguiente, paso);
      siguiente += 60 / c.bpm / 2; paso++;
    }
  }
  function arrancarMusica(){
    if (sonando || !gestoHecho || !asegurar()) return;
    sonando = true; paso = 0; siguiente = ctx.currentTime + 0.08;
    busMusica.gain.cancelScheduledValues(ctx.currentTime);
    busMusica.gain.setValueAtTime(0.0001, ctx.currentTime);
    busMusica.gain.exponentialRampToValueAtTime(VOL_MUSICA, ctx.currentTime + 1.2);
    reloj = setInterval(programador, 30); programador();
  }
  function pararMusica(){
    if (!sonando) return;
    sonando = false; clearInterval(reloj); reloj = null;
    if (ctx){ busMusica.gain.cancelScheduledValues(ctx.currentTime); busMusica.gain.setValueAtTime(busMusica.gain.value, ctx.currentTime); busMusica.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15); }
  }

  /* ---------- Botones ---------- */
  var ICONO_MUSICA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/><path class="tachado" d="M3 3l18 18"/></svg>';
  var ICONO_EFECTOS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path class="ondas" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/><path class="tachado" d="M16 9l6 6M22 9l-6 6"/></svg>';
  var botonesCreados = [];
  function pintarBotones(){
    botonesCreados.forEach(function(b){
      var on = pref[b.dataset.sonido];
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("apagado", !on);
      b.setAttribute("aria-label", b.dataset.sonido === "musica" ? (on ? "Apagar la música" : "Poner música") : (on ? "Silenciar los efectos" : "Activar los efectos de sonido"));
      b.title = b.getAttribute("aria-label");
    });
  }
  function botones(contenedor, antesDe){
    ["musica", "efectos"].forEach(function(tipo){
      var b = document.createElement("button");
      b.type = "button"; b.className = "icono-boton boton-sonido"; b.dataset.sonido = tipo;
      b.innerHTML = tipo === "musica" ? ICONO_MUSICA : ICONO_EFECTOS;
      b.addEventListener("click", function(){
        gestoHecho = true;
        pref[tipo] = !pref[tipo]; guardar(tipo, pref[tipo]);
        if (tipo === "musica"){ if (pref.musica) arrancarMusica(); else pararMusica(); }
        else if (pref.efectos) efecto("pop");
        pintarBotones();
      });
      contenedor.insertBefore(b, antesDe || null);
      botonesCreados.push(b);
    });
    pintarBotones();
  }

  /* El primer toque o tecla habilita el audio (y la música si se había dejado encendida) */
  function primerGesto(){
    if (gestoHecho && ctx && ctx.state === "running") return;
    gestoHecho = true;
    if (asegurar() && pref.musica) arrancarMusica();
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function(ev){ document.addEventListener(ev, primerGesto, { capture: true, passive: true }); });
  // Con la pestaña escondida no suena nada
  document.addEventListener("visibilitychange", function(){
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(function(){});
    else if (gestoHecho) ctx.resume().catch(function(){});
  });

  return {
    efecto: efecto,
    botones: botones,
    cancion: function(nombre){ if (CANCIONES[nombre]) cancionActual = nombre; },
    estado: function(){ return { musica: pref.musica, efectos: pref.efectos, sonando: sonando, contexto: ctx ? ctx.state : "sin crear" }; }
  };
})();
