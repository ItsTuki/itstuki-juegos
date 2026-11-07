/* 3 en raya (gato): contra la compu (fácil o imposible) o de a dos en el mismo dispositivo. */
Juegos.registrar({
  id: "gato",
  nombre: "3 en raya",
  descripcion: "El gato de siempre: contra la compu o de a dos.",
  icono: "✕",
  resumen: function(api){ var m = api.leer("gato:marcador", null); return m ? "Tú " + m.x + " · Compu " + m.o + " · Empates " + m.e : null; },
  montar: function(cont, api){
    "use strict";
    var el = api.el;
    var LINEAS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    var modo = api.leer("gato:modo", "facil"), tablero, turno, fin, marcador = api.leer("gato:marcador", { x: 0, o: 0, e: 0 });
    var estadoEl = el("p", { clase: "estado-juego", "aria-live": "polite" });
    var marcadorEl = el("div", { clase: "marcador" });
    var grilla = el("div", { clase: "grilla-gato", role: "grid", "aria-label": "Tablero de 3 en raya" });
    var celdas = [];
    for (var i = 0; i < 9; i++) (function(i){
      var b = el("button", { type: "button", clase: "celda-gato", "aria-label": "Casilla " + (i + 1) + " vacía", onclick: function(){ jugar(i); } });
      celdas.push(b); grilla.appendChild(b);
    })(i);

    var modos = el("div", { clase: "pildoras", role: "group", "aria-label": "Modo de juego" });
    [["facil", "Compu fácil"], ["imposible", "Compu imposible"], ["dos", "2 jugadores"]].forEach(function(m){
      modos.appendChild(el("button", { type: "button", "aria-pressed": m[0] === modo ? "true" : "false", "data-modo": m[0], texto: m[1], onclick: function(){
        modo = m[0]; api.guardar("gato:modo", modo);
        Array.prototype.forEach.call(modos.children, function(x){ x.setAttribute("aria-pressed", x.dataset.modo === modo ? "true" : "false"); });
        nueva();
      } }));
    });

    cont.appendChild(modos);
    cont.appendChild(marcadorEl);
    cont.appendChild(estadoEl);
    cont.appendChild(grilla);
    cont.appendChild(el("div", { clase: "fila-botones centrado" }, [
      el("button", { type: "button", clase: "boton", texto: "Nueva partida", onclick: nueva }),
      el("button", { type: "button", clase: "boton secundario chico", texto: "Reiniciar marcador", onclick: function(){ marcador = { x: 0, o: 0, e: 0 }; api.guardar("gato:marcador", marcador); pintarMarcador(); } })
    ]));

    function pintarMarcador(){
      marcadorEl.textContent = "";
      var ellos = modo === "dos" ? "O" : "Compu";
      marcadorEl.appendChild(el("span", null, [modo === "dos" ? "X " : "Tú ", el("b", { texto: String(marcador.x) })]));
      marcadorEl.appendChild(el("span", null, [ellos + " ", el("b", { texto: String(marcador.o) })]));
      marcadorEl.appendChild(el("span", null, ["Empates ", el("b", { texto: String(marcador.e) })]));
    }
    function ganador(t){
      for (var i = 0; i < LINEAS.length; i++){ var l = LINEAS[i]; if (t[l[0]] && t[l[0]] === t[l[1]] && t[l[1]] === t[l[2]]) return { quien: t[l[0]], linea: l }; }
      return t.every(Boolean) ? { quien: "empate" } : null;
    }
    function minimax(t, jugador){
      var g = ganador(t);
      if (g) return { puntos: g.quien === "O" ? 10 : g.quien === "X" ? -10 : 0 };
      var mejor = { puntos: jugador === "O" ? -Infinity : Infinity, i: -1 };
      for (var i = 0; i < 9; i++) if (!t[i]){
        t[i] = jugador;
        var r = minimax(t, jugador === "O" ? "X" : "O");
        t[i] = null;
        var p = r.puntos - (r.puntos > 0 ? 1 : r.puntos < 0 ? -1 : 0);
        if ((jugador === "O" && p > mejor.puntos) || (jugador === "X" && p < mejor.puntos)) mejor = { puntos: p, i: i };
      }
      return mejor;
    }
    function jugadaCompu(){
      var libres = []; tablero.forEach(function(v, i){ if (!v) libres.push(i); });
      if (modo === "facil" && Math.random() < 0.55) return libres[Math.floor(Math.random() * libres.length)];
      return minimax(tablero.slice(), "O").i;
    }
    function pintar(g){
      celdas.forEach(function(b, i){
        b.textContent = tablero[i] === "X" ? "✕" : tablero[i] === "O" ? "◯" : "";
        b.className = "celda-gato" + (tablero[i] ? " ficha-" + tablero[i].toLowerCase() : "") + (g && g.linea && g.linea.indexOf(i) >= 0 ? " gana" : "");
        b.disabled = !!tablero[i] || fin;
        b.setAttribute("aria-label", "Casilla " + (i + 1) + (tablero[i] ? ", " + tablero[i] : " vacía"));
      });
    }
    function cerrar(g){
      fin = true;
      if (g.quien === "empate"){ marcador.e++; estadoEl.textContent = "Empate. ¡Bien defendido!"; }
      else if (g.quien === "X"){ marcador.x++; estadoEl.textContent = modo === "dos" ? "¡Gana X!" : "¡Ganaste!"; }
      else { marcador.o++; estadoEl.textContent = modo === "dos" ? "¡Gana O!" : "Ganó la compu. Otra vez será."; }
      api.guardar("gato:marcador", marcador); pintarMarcador(); pintar(g);
    }
    function jugar(i){
      if (fin || tablero[i]) return;
      if (modo !== "dos" && turno !== "X") return;
      tablero[i] = turno;
      var g = ganador(tablero);
      if (g) return cerrar(g);
      turno = turno === "X" ? "O" : "X";
      if (modo !== "dos"){
        estadoEl.textContent = "La compu está pensando…"; pintar();
        setTimeout(function(){
          if (fin) return;
          tablero[jugadaCompu()] = "O"; turno = "X";
          var g2 = ganador(tablero);
          if (g2) return cerrar(g2);
          estadoEl.textContent = "Tu turno: juegas con ✕."; pintar();
        }, 350);
      } else { estadoEl.textContent = "Turno de " + (turno === "X" ? "✕" : "◯") + "."; pintar(); }
    }
    function nueva(){
      tablero = Array(9).fill(null); turno = "X"; fin = false;
      estadoEl.textContent = modo === "dos" ? "Empieza ✕." : "Tu turno: juegas con ✕.";
      pintarMarcador(); pintar();
    }
    nueva();
  }
});
