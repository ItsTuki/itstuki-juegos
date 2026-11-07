/* Ruleta europea (un solo cero) con TukiPoints, la moneda de la sala (sin dinero real).
   Apuestas: número pleno (paga 35 a 1), rojo/negro, par/impar, 1-18/19-36 (1 a 1) y docenas (2 a 1).
   Con el 0 pierden todas las apuestas de afuera. El saldo es el mismo del Blackjack (api.tukipoints).
   La tabla de posiciones guarda el máximo de TukiPoints que alcanzaste jugando a la ruleta. */
Juegos.registrar({
  id: "ruleta",
  nombre: "Ruleta",
  descripcion: "Apuesta a un número, a un color o a una docena y gira. Se juega con TukiPoints.",
  icono: "◎",
  tablas: [{ clave: "ruleta", nombre: "Ruleta", menorEsMejor: false, formato: function(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " TukiPoints"; } }],
  resumen: function(api){ var r = api.leer("record:ruleta", null); return r === null || r <= api.tukipoints.inicial ? "Saldo: " + api.tukipoints.texto(api.tukipoints.saldo()) : "Máximo: " + api.tukipoints.texto(r); },
  montar: function(cont, api){
    "use strict";
    var el = api.el, TP = api.tukipoints, INICIAL = TP.inicial;
    var SVG = "http://www.w3.org/2000/svg";
    var ORDEN = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
    var ROJOS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    var FICHAS = [10, 50, 100, 500];
    var GRADOS = 360 / ORDEN.length;
    var quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function color(n){ return n === 0 ? "verde" : ROJOS.indexOf(n) >= 0 ? "rojo" : "negro"; }
    // Apuestas de afuera: [clave, texto, pago (veces la apuesta además de devolverla), gana(n)]
    var AFUERA = [
      ["d1", "1ª docena", 2, function(n){ return n >= 1 && n <= 12; }],
      ["d2", "2ª docena", 2, function(n){ return n >= 13 && n <= 24; }],
      ["d3", "3ª docena", 2, function(n){ return n >= 25; }],
      ["bajo", "1 a 18", 1, function(n){ return n >= 1 && n <= 18; }],
      ["par", "Par", 1, function(n){ return n > 0 && n % 2 === 0; }],
      ["rojo", "Rojo", 1, function(n){ return color(n) === "rojo"; }],
      ["negro", "Negro", 1, function(n){ return color(n) === "negro"; }],
      ["impar", "Impar", 1, function(n){ return n % 2 === 1; }],
      ["alto", "19 a 36", 1, function(n){ return n >= 19; }]
    ];
    function datosApuesta(clave){
      // Plenos: "n0" a "n36". Ojo: "negro" también empieza con "n", por eso se compara el formato completo
      if (/^n\d+$/.test(clave)){ var n = +clave.slice(1); return { texto: "Pleno al " + n, pago: 35, gana: function(x){ return x === n; } }; }
      for (var i = 0; i < AFUERA.length; i++) if (AFUERA[i][0] === clave) return { texto: AFUERA[i][1], pago: AFUERA[i][2], gana: AFUERA[i][3] };
      return null;
    }

    var saldo = TP.saldo(), ficha = 10, apuestas = {}, ultimas = null, girando = false, enJuego = null, giro = 0, historial = api.leer("ruleta:historial", []);
    if (!Array.isArray(historial)) historial = [];

    /* ---------- Rueda (SVG) ---------- */
    function nodo(tag, attrs){ var n = document.createElementNS(SVG, tag); Object.keys(attrs || {}).forEach(function(k){ n.setAttribute(k, attrs[k]); }); return n; }
    function punto(r, grados){ var a = (grados - 90) * Math.PI / 180; return (100 + r * Math.cos(a)).toFixed(2) + " " + (100 + r * Math.sin(a)).toFixed(2); }
    var svg = nodo("svg", { viewBox: "0 0 200 200", "class": "rueda", "aria-hidden": "true" });
    var disco = nodo("g", { "class": "disco" }), casillasRueda = [];
    ORDEN.forEach(function(n, i){
      var a0 = i * GRADOS - GRADOS / 2, a1 = a0 + GRADOS;
      var c = nodo("path", { d: "M100 100 L" + punto(96, a0) + " A96 96 0 0 1 " + punto(96, a1) + " Z", "class": "casilla-rueda " + color(n) });
      casillasRueda.push(c); disco.appendChild(c);
      var t = nodo("text", { x: "100", y: "17", "class": "numero-rueda", transform: "rotate(" + (i * GRADOS) + " 100 100)" });
      t.textContent = String(n);
      disco.appendChild(t);
    });
    disco.appendChild(nodo("circle", { cx: "100", cy: "100", r: "76", "class": "pista-rueda" }));
    var resalte = nodo("path", { "class": "resalte-rueda" });
    resalte.style.display = "none";
    disco.appendChild(resalte);
    disco.appendChild(nodo("circle", { cx: "100", cy: "100", r: "62", "class": "centro-rueda" }));
    disco.appendChild(nodo("circle", { cx: "100", cy: "100", r: "20", "class": "eje-rueda" }));
    svg.appendChild(disco);
    var bolaRueda = nodo("circle", { cx: "100", cy: "9", r: "4.3", "class": "bola-rueda" });
    bolaRueda.style.display = "none";
    svg.appendChild(bolaRueda);
    var bola = el("b", { clase: "resultado-rueda", texto: "?" });
    var rueda = el("div", { clase: "marco-rueda" }, [ svg, el("span", { clase: "flecha-rueda", "aria-hidden": "true" }), bola ]);

    /* ---------- Paño ---------- */
    var saldoEl = el("b"), apuestaEl = el("b");
    var estadoEl = el("p", { clase: "estado-juego", "aria-live": "polite" });
    var historialEl = el("div", { clase: "historial-ruleta", "aria-label": "Últimos números" });
    var botones = {};
    function casilla(clave, texto, extra, etiqueta){
      var b = el("button", { type: "button", clase: "casilla-pano " + (extra || ""), "data-apuesta": clave, onclick: function(){ apostar(clave); } }, [
        el("span", { texto: texto }), el("i", { clase: "monto-pano" })
      ]);
      b.dataset.etiqueta = etiqueta || texto;
      botones[clave] = b;
      return b;
    }
    var numeros = el("div", { clase: "numeros-pano", role: "group", "aria-label": "Números" });
    numeros.appendChild(casilla("n0", "0", "verde cero", "Pleno al 0"));
    for (var n = 1; n <= 36; n++){
      // Horizontal: 3 filas de 12 (arriba 3·6·9…). Vertical (celular): 12 filas de 3.
      var b = casilla("n" + n, String(n), color(n), "Pleno al " + n + ", " + color(n));
      b.style.setProperty("--hc", String(Math.ceil(n / 3) + 1));
      b.style.setProperty("--hf", String(3 - ((n - 1) % 3)));
      b.style.setProperty("--vc", String(((n - 1) % 3) + 1));
      b.style.setProperty("--vf", String(Math.ceil(n / 3) + 1));
      numeros.appendChild(b);
    }
    var docenas = el("div", { clase: "afuera-pano docenas", role: "group", "aria-label": "Docenas" }, AFUERA.slice(0, 3).map(function(a){ return casilla(a[0], a[1], "afuera"); }));
    var simples = el("div", { clase: "afuera-pano simples", role: "group", "aria-label": "Apuestas simples" }, AFUERA.slice(3).map(function(a){ return casilla(a[0], a[1], "afuera " + a[0]); }));

    var selector = el("div", { clase: "pildoras fichas-ruleta", role: "group", "aria-label": "Valor de la ficha" }, FICHAS.map(function(v){
      return el("button", { type: "button", "data-ficha": String(v), "aria-pressed": v === ficha ? "true" : "false", texto: api.miles(v),
        onclick: function(){ ficha = v; pintar(); } });
    }));
    var controles = el("div", { clase: "fila-botones centrado" });

    cont.appendChild(el("div", { clase: "marcador" }, [ el("span", null, ["TukiPoints ", saldoEl]), el("span", null, ["Apuesta ", apuestaEl]) ]));
    cont.appendChild(el("div", { clase: "mesa-ruleta" }, [ rueda, historialEl ]));
    cont.appendChild(estadoEl);
    cont.appendChild(el("p", { clase: "ayuda-ficha", texto: "Ficha:" }));
    cont.appendChild(selector);
    cont.appendChild(el("div", { clase: "pano" }, [ numeros, docenas, simples ]));
    cont.appendChild(controles);
    cont.appendChild(el("p", { clase: "ayuda-juego", texto: "Toca una casilla para poner la ficha (puedes poner varias). Pleno paga 35 a 1, docena 2 a 1, color, par/impar y mitades 1 a 1. Con el 0 solo gana el pleno al 0. Se juega con TukiPoints: no hay dinero real." }));

    function totalApostado(){ return Object.keys(apuestas).reduce(function(s, k){ return s + apuestas[k]; }, 0); }
    // Al girar, la apuesta ya se descontó del saldo
    function libre(){ return girando ? saldo : saldo - totalApostado(); }

    function pintar(){
      var total = totalApostado();
      saldoEl.textContent = api.miles(libre()); apuestaEl.textContent = api.miles(total);
      Array.prototype.forEach.call(selector.children, function(b){ b.setAttribute("aria-pressed", +b.dataset.ficha === ficha ? "true" : "false"); b.disabled = girando; });
      Object.keys(botones).forEach(function(k){
        var b = botones[k], m = apuestas[k] || 0;
        b.querySelector(".monto-pano").textContent = m ? api.miles(m) : "";
        b.classList.toggle("con-ficha", m > 0);
        b.disabled = girando;
        b.setAttribute("aria-label", b.dataset.etiqueta + (m ? ", apostado " + api.miles(m) : ""));
      });
      controles.textContent = "";
      controles.appendChild(el("button", { type: "button", clase: "boton", texto: girando ? "Girando…" : "Girar", disabled: girando || total < 10, onclick: girar }));
      controles.appendChild(el("button", { type: "button", clase: "boton secundario chico", texto: "Limpiar", disabled: girando || !total, onclick: function(){ apuestas = {}; pintar(); } }));
      if (ultimas && !total) controles.appendChild(el("button", { type: "button", clase: "boton secundario chico", texto: "Repetir apuesta", disabled: girando, onclick: repetir }));
      if (!girando && saldo > INICIAL) controles.appendChild(el("button", { type: "button", clase: "boton secundario chico", texto: "Anotar mis TukiPoints", onclick: function(){ api.ofrecerGuardar("ruleta", saldo); } }));
      if (!girando && saldo < 10) controles.appendChild(el("button", { type: "button", clase: "boton", texto: "Recargar " + TP.texto(INICIAL), onclick: function(){ saldo = INICIAL; TP.guardar(saldo); estadoEl.textContent = "TukiPoints recargados. ¡Suerte!"; pintar(); } }));
      historialEl.textContent = "";
      historial.forEach(function(x, i){ historialEl.appendChild(el("span", { clase: "bolita " + color(x) + (i === 0 ? " ultima" : ""), texto: String(x) })); });
    }

    function apostar(clave){
      if (girando) return;
      if (libre() < ficha){ api.sonido.efecto("error"); api.aviso(libre() < 10 ? "No te quedan TukiPoints libres." : "No alcanza para esa ficha. Elige una más chica."); return; }
      apuestas[clave] = (apuestas[clave] || 0) + ficha;
      api.sonido.efecto("ficha");
      pintar();
    }
    function repetir(){
      var total = Object.keys(ultimas).reduce(function(s, k){ return s + ultimas[k]; }, 0);
      if (total > saldo){ api.aviso("No te alcanza para repetir esa apuesta."); return; }
      apuestas = Object.assign({}, ultimas); pintar();
    }

    /* ---------- Animación del giro ----------
       La rueda gira a la derecha y frena; la bola corre al revés por el borde, pierde fuerza, cae
       rebotando hacia las casillas y termina en la ganadora, que queda justo bajo la flecha.
       Con "reducir movimiento" del sistema el giro es más corto y suave, pero se ve igual. */
    var anim = null, bolaAng = 0, bolaVisible = false;
    function easeOut(t){ return 1 - Math.pow(1 - t, 3); }
    function ponerRueda(grados){ disco.setAttribute("transform", "rotate(" + grados.toFixed(3) + " 100 100)"); }
    function ponerBola(grados, r){
      var a = grados * Math.PI / 180;
      bolaRueda.setAttribute("cx", (100 + r * Math.sin(a)).toFixed(2));
      bolaRueda.setAttribute("cy", (100 - r * Math.cos(a)).toFixed(2));
    }
    function animar(i, alTerminar){
      var DURA = quieto ? 2400 : 5600, VUELTAS = quieto ? 1 : 4, VUELTAS_BOLA = quieto ? 1 : 3, CAE = 0.55, ENTRA = 0.8;
      var w0 = giro, destino = ((-i * GRADOS - w0) % 360 + 360) % 360, dw = VUELTAS * 360 + destino;
      // La bola parte donde quedó la anterior (o arriba la primera vez)
      var bola0 = bolaVisible ? bolaAng : 0, casilla0 = w0 + i * GRADOS;
      var R = ((bola0 - casilla0) % 360 + 360) % 360 + VUELTAS_BOLA * 360;
      bolaRueda.style.display = ""; bolaVisible = true;
      resalte.style.display = "none";
      var t0 = null, casillaBola = null, rebotes = 0;
      function cuadro(ahora){
        if (t0 === null) t0 = ahora;
        var t = Math.min(1, (ahora - t0) / DURA);
        var w = w0 + dw * easeOut(t), casilla = w + i * GRADOS;
        var u = Math.min(1, t / ENTRA), ang = casilla + R * (1 - easeOut(u)), radio = 91;
        if (t >= ENTRA) radio = 72;
        else if (t > CAE){
          var p = (t - CAE) / (ENTRA - CAE), rebote = Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p);
          radio = 91 - 19 * p + 6 * rebote;
          ang += 5 * Math.sin(p * Math.PI * 3) * (1 - p);
        }
        ponerRueda(w); ponerBola(ang, radio); bolaAng = ang;
        // Sonido: la bola golpea los separadores mientras corre y rebota al caer
        var c = Math.floor((((ang - w) % 360 + 360) % 360 + GRADOS / 2) / GRADOS);
        if (casillaBola !== null && c !== casillaBola && t < CAE) api.sonido.efecto("tick", 1 - t / CAE);
        casillaBola = c;
        if (t > CAE && t < ENTRA){
          var r3 = Math.floor((t - CAE) / (ENTRA - CAE) * 3);
          if (r3 > rebotes - 1 && r3 < 3 && rebotes <= r3){ api.sonido.efecto("bola", 1 - r3 / 3); rebotes = r3 + 1; }
        }
        if (t < 1) anim = requestAnimationFrame(cuadro);
        else { anim = null; giro = w; api.sonido.efecto("cae"); resalte.setAttribute("d", casillasRueda[i].getAttribute("d")); resalte.style.display = ""; alTerminar(); }
      }
      anim = requestAnimationFrame(cuadro);
    }

    function girar(){
      var total = totalApostado();
      if (girando || total < 10 || total > saldo) return;
      var buf = new Uint32Array(1); crypto.getRandomValues(buf);
      var sale = ORDEN[buf[0] % ORDEN.length], i = ORDEN.indexOf(sale);
      // Se descuenta y se guarda antes de girar: salir a mitad del giro no anula la apuesta
      girando = true; ultimas = Object.assign({}, apuestas);
      enJuego = { apuestas: Object.assign({}, apuestas), apostado: total, sale: sale };
      saldo -= total; TP.guardar(saldo);
      estadoEl.textContent = "No va más…";
      bola.textContent = "…"; bola.className = "resultado-rueda girando";
      pintar();
      animar(i, function(){ resolver(false); });
    }

    // silencioso: se cerró el juego a mitad del giro; solo se paga y se guarda
    function resolver(silencioso){
      var jugada = enJuego; enJuego = null;
      if (!jugada) return;
      var sale = jugada.sale, apostado = jugada.apostado, premio = 0, aciertos = [];
      Object.keys(jugada.apuestas).forEach(function(k){
        var d = datosApuesta(k);
        if (d && d.gana(sale)){ premio += jugada.apuestas[k] * (d.pago + 1); aciertos.push(d.texto); }
      });
      var neto = premio - apostado;
      saldo += premio;
      TP.guardar(saldo);
      historial.unshift(sale); historial = historial.slice(0, 12); api.guardar("ruleta:historial", historial);
      if (silencioso){ api.record("ruleta", saldo, false); return; }
      bola.textContent = String(sale); bola.className = "resultado-rueda aparece " + color(sale);
      var nombreColor = { rojo: "rojo", negro: "negro", verde: "verde" }[color(sale)];
      var texto = "Salió el " + sale + " " + nombreColor + ". ";
      if (neto > 0) texto += "¡Ganas " + TP.texto(neto) + "! (" + aciertos.join(", ") + ")";
      else if (premio > 0) texto += "Recuperas " + TP.texto(premio) + " de " + api.miles(apostado) + ".";
      else texto += "Pierdes " + TP.texto(apostado) + ".";
      if (saldo < 10) texto += " Te quedaste sin TukiPoints.";
      setTimeout(function(){ api.sonido.efecto(neto >= apostado * 10 && neto > 0 ? "grande" : neto > 0 ? "ganar" : premio > 0 ? "empate" : "perder"); }, 180);
      estadoEl.textContent = texto;
      apuestas = {}; girando = false;
      pintar();
      // Nuevo máximo de TukiPoints: se ofrece anotarlo en la tabla (también la primera vez)
      var r = api.record("ruleta", saldo, false);
      if (r.mejora && saldo > INICIAL){
        if (r.nuevo) api.aviso("¡Nuevo máximo: " + TP.texto(saldo) + "!");
        api.ofrecerGuardar("ruleta", saldo);
      }
    }

    function tecla(e){
      if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") return;
      if (e.key === "Enter" || e.key === " "){ e.preventDefault(); girar(); }
    }
    document.addEventListener("keydown", tecla);
    estadoEl.textContent = "Elige una ficha, toca dónde apostar y gira.";
    pintar();
    return function(){ document.removeEventListener("keydown", tecla); if (anim){ cancelAnimationFrame(anim); anim = null; resolver(true); } };
  }
});
