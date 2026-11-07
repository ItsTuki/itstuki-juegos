/* Buscaminas: descubre todas las casillas sin minas. La primera casilla nunca es mina.
   Clic = descubrir, clic derecho o mantener presionado = bandera. En el celular hay un botón para cambiar de modo. */
Juegos.registrar({
  id: "buscaminas",
  nombre: "Buscaminas",
  descripcion: "Descubre el tablero sin pisar ninguna mina.",
  icono: "✹",
  tablas: [
    { clave: "buscaminas-facil", nombre: "Fácil", menorEsMejor: true, formato: function(n){ return n + " s"; } },
    { clave: "buscaminas-medio", nombre: "Medio", menorEsMejor: true, formato: function(n){ return n + " s"; } }
  ],
  resumen: function(api){ var r = api.leer("record:buscaminas-facil", null); return r === null ? null : "Mejor tiempo (fácil): " + r + " s"; },
  montar: function(cont, api){
    "use strict";
    var el = api.el;
    var NIVELES = { facil: { f: 9, c: 9, minas: 10, nombre: "Fácil" }, medio: { f: 12, c: 12, minas: 24, nombre: "Medio" } };
    var nivel = api.leer("buscaminas:nivel", "facil"), modoBandera = false;
    var celdas, minas, abiertas, banderas, primera, fin, inicio, reloj;
    var minasEl = el("b"), tiempoEl = el("b", { texto: "0" }), estadoEl = el("p", { clase: "estado-juego", "aria-live": "polite" });
    var tablero = el("div", { clase: "tablero-minas", role: "grid", "aria-label": "Tablero de buscaminas" });
    var botonModo = el("button", { type: "button", clase: "boton secundario chico", "aria-pressed": "false", texto: "Modo: descubrir", onclick: function(){
      modoBandera = !modoBandera; botonModo.setAttribute("aria-pressed", modoBandera ? "true" : "false"); botonModo.textContent = modoBandera ? "Modo: bandera ⚑" : "Modo: descubrir";
    } });
    var niveles = el("div", { clase: "pildoras", role: "group", "aria-label": "Nivel" });
    Object.keys(NIVELES).forEach(function(k){
      niveles.appendChild(el("button", { type: "button", "data-nivel": k, "aria-pressed": k === nivel ? "true" : "false", texto: NIVELES[k].nombre, onclick: function(){
        nivel = k; api.guardar("buscaminas:nivel", k);
        Array.prototype.forEach.call(niveles.children, function(b){ b.setAttribute("aria-pressed", b.dataset.nivel === nivel ? "true" : "false"); });
        api.mostrarTabla("buscaminas-" + nivel); nueva();
      } }));
    });
    cont.appendChild(niveles);
    cont.appendChild(el("div", { clase: "marcador" }, [ el("span", null, ["Minas ", minasEl]), el("span", null, ["Tiempo ", tiempoEl, " s"]) ]));
    cont.appendChild(estadoEl);
    cont.appendChild(el("div", { clase: "marco-minas" }, [tablero]));
    cont.appendChild(el("div", { clase: "fila-botones centrado" }, [ botonModo, el("button", { type: "button", clase: "boton", texto: "Nueva partida", onclick: nueva }) ]));
    cont.appendChild(el("p", { clase: "ayuda-juego", texto: "Clic para descubrir; clic derecho o mantener presionado para poner bandera. El número dice cuántas minas hay alrededor." }));

    function vecinos(i){
      var n = NIVELES[nivel], f = Math.floor(i / n.c), c = i % n.c, r = [];
      for (var df = -1; df <= 1; df++) for (var dc = -1; dc <= 1; dc++){
        if (!df && !dc) continue;
        var ff = f + df, cc = c + dc;
        if (ff >= 0 && cc >= 0 && ff < n.f && cc < n.c) r.push(ff * n.c + cc);
      }
      return r;
    }
    function nueva(){
      var n = NIVELES[nivel];
      clearInterval(reloj); tiempoEl.textContent = "0";
      minas = new Set(); abiertas = new Set(); banderas = new Set(); primera = true; fin = false;
      tablero.style.setProperty("--columnas", n.c);
      tablero.className = "tablero-minas nivel-" + nivel;
      tablero.textContent = ""; celdas = [];
      for (var i = 0; i < n.f * n.c; i++) (function(i){
        var b = el("button", { type: "button", clase: "celda-mina", "aria-label": "Fila " + (Math.floor(i / n.c) + 1) + ", columna " + (i % n.c + 1) + ", tapada" });
        b.addEventListener("click", function(){ if (modoBandera) alternar(i); else descubrir(i); });
        b.addEventListener("contextmenu", function(e){ e.preventDefault(); alternar(i); });
        var t;
        b.addEventListener("touchstart", function(){ t = setTimeout(function(){ t = null; alternar(i); b.dataset.largo = "1"; if (navigator.vibrate) navigator.vibrate(20); }, 420); }, { passive: true });
        b.addEventListener("touchend", function(e){ if (t){ clearTimeout(t); t = null; } if (b.dataset.largo){ e.preventDefault(); delete b.dataset.largo; } });
        b.addEventListener("touchmove", function(){ if (t){ clearTimeout(t); t = null; } }, { passive: true });
        celdas.push(b); tablero.appendChild(b);
      })(i);
      minasEl.textContent = String(n.minas);
      estadoEl.textContent = "Toca cualquier casilla para empezar.";
    }
    function sembrar(seguro){
      var n = NIVELES[nivel], prohibidas = new Set([seguro].concat(vecinos(seguro)));
      while (minas.size < n.minas){ var i = Math.floor(Math.random() * n.f * n.c); if (!prohibidas.has(i)) minas.add(i); }
    }
    function cuenta(i){ return vecinos(i).filter(function(v){ return minas.has(v); }).length; }
    function descubrir(i){
      if (fin || banderas.has(i)) return;
      if (primera){ primera = false; sembrar(i); inicio = Date.now(); reloj = setInterval(function(){ tiempoEl.textContent = String(Math.floor((Date.now() - inicio) / 1000)); }, 250); estadoEl.textContent = ""; }
      if (abiertas.has(i)){ // acorde: si las banderas alrededor coinciden, abre los vecinos
        var vs = vecinos(i), nb = vs.filter(function(v){ return banderas.has(v); }).length;
        if (nb === cuenta(i)) vs.forEach(function(v){ if (!abiertas.has(v) && !banderas.has(v)) abrir(v); });
      } else abrir(i);
      if (!fin) api.sonido.efecto("abrir");
      revisar();
    }
    function abrir(i){
      if (abiertas.has(i) || banderas.has(i) || fin) return;
      if (minas.has(i)) return perder(i);
      var pila = [i];
      while (pila.length){
        var a = pila.pop(); if (abiertas.has(a) || banderas.has(a)) continue;
        abiertas.add(a);
        var k = cuenta(a), b = celdas[a];
        b.className = "celda-mina abierta n" + k; b.textContent = k ? String(k) : ""; b.disabled = !k;
        b.setAttribute("aria-label", k ? k + " minas alrededor" : "Vacía");
        if (!k) vecinos(a).forEach(function(v){ if (!abiertas.has(v)) pila.push(v); });
      }
    }
    function alternar(i){
      if (fin || abiertas.has(i) || primera) { if (primera) api.aviso("Primero descubre una casilla."); return; }
      if (banderas.has(i)){ banderas.delete(i); celdas[i].className = "celda-mina"; celdas[i].textContent = ""; }
      else { banderas.add(i); celdas[i].className = "celda-mina bandera"; celdas[i].textContent = "⚑"; }
      celdas[i].setAttribute("aria-label", banderas.has(i) ? "Bandera" : "Tapada");
      api.sonido.efecto(banderas.has(i) ? "bandera" : "clic");
      minasEl.textContent = String(NIVELES[nivel].minas - banderas.size);
    }
    function perder(i){
      fin = true; clearInterval(reloj);
      api.sonido.efecto("boom");
      minas.forEach(function(m){ var b = celdas[m]; b.className = "celda-mina mina" + (m === i ? " explotada" : ""); b.textContent = "✹"; });
      banderas.forEach(function(f){ if (!minas.has(f)) { celdas[f].className = "celda-mina error"; celdas[f].textContent = "✕"; } });
      celdas.forEach(function(b){ b.disabled = true; });
      estadoEl.textContent = "¡Boom! Pisaste una mina. Prueba otra vez.";
    }
    function revisar(){
      if (fin) return;
      var n = NIVELES[nivel];
      if (abiertas.size === n.f * n.c - n.minas){
        fin = true; clearInterval(reloj);
        var segundos = Math.max(1, Math.round((Date.now() - inicio) / 1000)); tiempoEl.textContent = String(segundos);
        minas.forEach(function(m){ celdas[m].className = "celda-mina bandera"; celdas[m].textContent = "⚑"; celdas[m].disabled = true; });
        var r = api.record("buscaminas-" + nivel, segundos, true);
        api.sonido.efecto(r.nuevo ? "record" : "ganar");
        estadoEl.textContent = "¡Despejaste el tablero en " + segundos + " s!" + (r.nuevo ? " Nuevo récord." : "");
        api.ofrecerGuardar("buscaminas-" + nivel, segundos);
      }
    }
    api.mostrarTabla("buscaminas-" + nivel);
    nueva();
    return function(){ clearInterval(reloj); };
  }
});
