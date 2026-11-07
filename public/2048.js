/* 2048: desliza para juntar fichas iguales. Puntos = suma de cada fusión. */
Juegos.registrar({
  id: "2048",
  nombre: "2048",
  descripcion: "Junta fichas iguales hasta llegar a 2048 (o más).",
  icono: "2⁰⁴⁸",
  tablas: [{ clave: "2048", nombre: "2048", menorEsMejor: false }],
  resumen: function(api){ var r = api.leer("record:2048", null); return r === null ? null : "Récord: " + api.miles(r); },
  montar: function(cont, api){
    "use strict";
    var el = api.el, N = 4;
    var grilla, puntos, gano, seguir, terminado, anterior = null;
    var puntosEl = el("b"), recordEl = el("b", { texto: api.miles(api.leer("record:2048", 0)) });
    var tablero = el("div", { clase: "tablero-2048", role: "grid", "aria-label": "Tablero de 2048" });
    var capa = el("div", { clase: "capa-juego", hidden: true });
    var marco = el("div", { clase: "marco-2048" }, [tablero, capa]);
    var estadoEl = el("p", { clase: "solo-lector", "aria-live": "polite" });
    cont.appendChild(el("div", { clase: "marcador" }, [ el("span", null, ["Puntos ", puntosEl]), el("span", null, ["Récord ", recordEl]) ]));
    cont.appendChild(marco);
    cont.appendChild(estadoEl);
    cont.appendChild(el("div", { clase: "fila-botones centrado" }, [
      el("button", { type: "button", clase: "boton", texto: "Nueva partida", onclick: nueva }),
      el("button", { type: "button", clase: "boton secundario chico", texto: "Deshacer", onclick: deshacer })
    ]));
    cont.appendChild(el("p", { clase: "ayuda-juego", texto: "Flechas o WASD para mover. En el celular, desliza sobre el tablero o usa los botones." }));
    cont.appendChild(api.cruceta(mover));

    function vacia(){ var g = []; for (var i = 0; i < N; i++) g.push([0, 0, 0, 0]); return g; }
    function agregar(){
      var libres = [];
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!grilla[y][x]) libres.push([y, x]);
      if (!libres.length) return null;
      var p = libres[Math.floor(Math.random() * libres.length)];
      grilla[p[0]][p[1]] = Math.random() < 0.9 ? 2 : 4;
      return p;
    }
    function nueva(){
      grilla = vacia(); puntos = 0; gano = false; seguir = false; terminado = false; anterior = null;
      agregar(); agregar(); capa.hidden = true; pintar();
    }
    function deslizarFila(fila){
      var f = fila.filter(Boolean), suma = 0, unidas = [];
      for (var i = 0; i < f.length - 1; i++) if (f[i] === f[i + 1]){ f[i] *= 2; suma += f[i]; unidas.push(i); f.splice(i + 1, 1); }
      while (f.length < N) f.push(0);
      return { fila: f, suma: suma, unidas: unidas };
    }
    function mover(dir){
      if (terminado && !seguir) return;
      if (!capa.hidden && !terminado) return;
      var copia = grilla.map(function(f){ return f.slice(); }), sumaTotal = 0, movio = false, nuevas = {};
      for (var k = 0; k < N; k++){
        var linea = [];
        for (var j = 0; j < N; j++){
          var y = dir === "arriba" ? j : dir === "abajo" ? N - 1 - j : k;
          var x = dir === "izquierda" ? j : dir === "derecha" ? N - 1 - j : k;
          linea.push(grilla[y][x]);
        }
        var r = deslizarFila(linea); sumaTotal += r.suma;
        for (j = 0; j < N; j++){
          y = dir === "arriba" ? j : dir === "abajo" ? N - 1 - j : k;
          x = dir === "izquierda" ? j : dir === "derecha" ? N - 1 - j : k;
          if (grilla[y][x] !== r.fila[j]) movio = true;
          grilla[y][x] = r.fila[j];
          if (r.unidas.indexOf(j) >= 0) nuevas[y + "," + x] = "unida";
        }
      }
      if (!movio) return;
      anterior = { grilla: copia, puntos: puntos };
      puntos += sumaTotal;
      if (sumaTotal) api.sonido.efecto("unir", Math.max.apply(null, grilla.map(function(f){ return Math.max.apply(null, f); }))); else api.sonido.efecto("mover");
      var p = agregar(); if (p) nuevas[p[0] + "," + p[1]] = "nueva";
      pintar(nuevas);
      if (!gano && grilla.some(function(f){ return f.indexOf(2048) >= 0; })){ gano = true; api.sonido.efecto("grande"); mostrarCapa("¡Llegaste a 2048!", "Puedes seguir jugando por más puntos.", "Seguir jugando", function(){ seguir = true; capa.hidden = true; }); }
      else if (!hayMovimientos()) terminar();
    }
    function hayMovimientos(){
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++){
        if (!grilla[y][x]) return true;
        if (x < N - 1 && grilla[y][x] === grilla[y][x + 1]) return true;
        if (y < N - 1 && grilla[y][x] === grilla[y + 1][x]) return true;
      }
      return false;
    }
    function terminar(){
      terminado = true; seguir = false;
      var r = api.record("2048", puntos, false); recordEl.textContent = api.miles(r.record);
      api.sonido.efecto(r.nuevo ? "record" : "perder");
      mostrarCapa("Sin movimientos", api.miles(puntos) + " puntos" + (r.nuevo ? " · ¡nuevo récord!" : ""), "Otra vez", nueva);
      if (puntos > 0) api.ofrecerGuardar("2048", puntos);
    }
    function deshacer(){
      if (!anterior) return api.aviso("No hay jugada para deshacer.");
      grilla = anterior.grilla; puntos = anterior.puntos; anterior = null; terminado = false; capa.hidden = true; pintar();
    }
    function mostrarCapa(titulo, texto, boton, accion){
      capa.textContent = ""; capa.hidden = false;
      capa.appendChild(el("b", { texto: titulo })); capa.appendChild(el("p", { texto: texto }));
      capa.appendChild(el("button", { type: "button", clase: "boton", texto: boton, onclick: accion }));
    }
    function pintar(marcas){
      marcas = marcas || {};
      puntosEl.textContent = api.miles(puntos);
      var r = api.leer("record:2048", 0); if (puntos > r) recordEl.textContent = api.miles(puntos);
      tablero.textContent = "";
      var maximo = 0;
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++){
        var v = grilla[y][x]; maximo = Math.max(maximo, v);
        tablero.appendChild(el("div", { clase: "ficha-2048 v" + Math.min(v, 4096) + (marcas[y + "," + x] ? " " + marcas[y + "," + x] : ""), role: "gridcell", texto: v ? String(v) : "" }));
      }
      estadoEl.textContent = "Puntos " + puntos + ". Ficha más alta " + maximo + ".";
    }
    function tecla(e){
      if (e.target.tagName === "INPUT") return;
      var d = api.TECLAS[e.key]; if (d){ e.preventDefault(); mover(d); }
    }
    api.deslizar(marco, mover);
    document.addEventListener("keydown", tecla);
    nueva();
    return function(){ document.removeEventListener("keydown", tecla); };
  }
});
