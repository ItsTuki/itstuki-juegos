/* Blackjack con TukiPoints, la moneda de la sala (sin dinero real).
   Reglas: el crupier pide hasta 17 y se planta en 17 suave; blackjack paga 3 a 2; se puede doblar con 2 cartas.
   El saldo es el mismo de la Ruleta (api.tukipoints). La tabla guarda el máximo de TukiPoints que alcanzaste aquí. */
Juegos.registrar({
  id: "blackjack",
  nombre: "Blackjack",
  descripcion: "Llega a 21 sin pasarte. Se juega con TukiPoints, sin dinero real.",
  icono: "♠",
  tablas: [{ clave: "blackjack", nombre: "Blackjack", menorEsMejor: false, formato: function(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " TukiPoints"; } }],
  resumen: function(api){ var r = api.leer("record:blackjack", null); return r === null ? null : "Máximo: " + api.tukipoints.texto(r); },
  montar: function(cont, api){
    "use strict";
    var el = api.el, TP = api.tukipoints, INICIAL = TP.inicial;
    var PALOS = [["♠", "negro"], ["♥", "rojo"], ["♦", "rojo"], ["♣", "negro"]];
    var VALORES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    var fichas = TP.saldo(), apuesta = Math.min(50, fichas), mazo = [], jugador = [], crupier = [], fase = "apostar", doblada = false;

    var fichasEl = el("b"), apuestaEl = el("b");
    var manoCrupier = el("div", { clase: "mano", "aria-label": "Cartas del crupier" }), totalCrupier = el("span", { clase: "total-mano" });
    var manoJugador = el("div", { clase: "mano", "aria-label": "Tus cartas" }), totalJugador = el("span", { clase: "total-mano" });
    var estadoEl = el("p", { clase: "estado-juego", "aria-live": "polite" });
    var controles = el("div", { clase: "fila-botones centrado controles-bj" });

    cont.appendChild(el("div", { clase: "marcador" }, [ el("span", null, ["TukiPoints ", fichasEl]), el("span", null, ["Apuesta ", apuestaEl]) ]));
    cont.appendChild(el("div", { clase: "mesa" }, [
      el("div", { clase: "lado-mesa" }, [ el("h3", null, ["Crupier ", totalCrupier]), manoCrupier ]),
      el("div", { clase: "lado-mesa" }, [ el("h3", null, ["Tú ", totalJugador]), manoJugador ])
    ]));
    cont.appendChild(estadoEl);
    cont.appendChild(controles);
    cont.appendChild(el("p", { clase: "ayuda-juego", texto: "El crupier pide hasta 17. Blackjack paga 3 a 2. Se juega con TukiPoints: no hay dinero real." }));

    function nuevoMazo(){
      mazo = [];
      for (var m = 0; m < 4; m++) PALOS.forEach(function(p){ VALORES.forEach(function(v){ mazo.push({ v: v, p: p[0], color: p[1] }); }); });
      for (var i = mazo.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = mazo[i]; mazo[i] = mazo[j]; mazo[j] = t; }
    }
    function sacar(){ if (mazo.length < 20) nuevoMazo(); return mazo.pop(); }
    function total(mano){
      var t = 0, ases = 0;
      mano.forEach(function(c){ if (c.oculta) return; if (c.v === "A"){ ases++; t += 11; } else t += ["J", "Q", "K"].indexOf(c.v) >= 0 ? 10 : +c.v; });
      while (t > 21 && ases){ t -= 10; ases--; }
      return { t: t, suave: ases > 0 };
    }
    function carta(c){
      if (c.oculta) return el("span", { clase: "carta oculta", "aria-label": "Carta tapada" });
      return el("span", { clase: "carta " + c.color, "aria-label": c.v + " de " + { "♠": "picas", "♥": "corazones", "♦": "diamantes", "♣": "tréboles" }[c.p] }, [
        el("span", { clase: "esq", texto: c.v + c.p }), el("span", { clase: "palo", texto: c.p })
      ]);
    }
    function pintar(){
      fichasEl.textContent = api.miles(fichas); apuestaEl.textContent = api.miles(apuesta);
      manoCrupier.textContent = ""; crupier.forEach(function(c){ manoCrupier.appendChild(carta(c)); });
      manoJugador.textContent = ""; jugador.forEach(function(c){ manoJugador.appendChild(carta(c)); });
      totalCrupier.textContent = crupier.length ? "(" + total(crupier).t + ")" : "";
      totalJugador.textContent = jugador.length ? "(" + total(jugador).t + ")" : "";
      controles.textContent = "";
      if (fase === "apostar" || fase === "fin"){
        [10, 50, 100].forEach(function(n){
          controles.appendChild(el("button", { type: "button", clase: "boton secundario chico", texto: "+" + n, disabled: apuesta + n > fichas, onclick: function(){ apuesta = Math.min(fichas, apuesta + n); pintar(); } }));
        });
        controles.appendChild(el("button", { type: "button", clase: "boton secundario chico", texto: "Limpiar", onclick: function(){ apuesta = 0; pintar(); } }));
        controles.appendChild(el("button", { type: "button", clase: "boton", texto: "Repartir", disabled: apuesta < 10 || apuesta > fichas, onclick: repartir }));
        if (fichas < 10) controles.appendChild(el("button", { type: "button", clase: "boton", texto: "Recargar " + TP.texto(INICIAL), onclick: function(){ fichas = INICIAL; apuesta = 50; guardarFichas(); estadoEl.textContent = "TukiPoints recargados. ¡Suerte!"; pintar(); } }));
        if (fichas > INICIAL) controles.appendChild(el("button", { type: "button", clase: "boton secundario chico", texto: "Anotar mis TukiPoints", onclick: function(){ api.ofrecerGuardar("blackjack", fichas); } }));
      } else if (fase === "jugar"){
        controles.appendChild(el("button", { type: "button", clase: "boton", texto: "Pedir", onclick: pedir }));
        controles.appendChild(el("button", { type: "button", clase: "boton secundario", texto: "Plantarse", onclick: plantarse }));
        if (jugador.length === 2 && fichas >= apuesta * 2) controles.appendChild(el("button", { type: "button", clase: "boton secundario", texto: "Doblar", onclick: doblar }));
      }
    }
    function guardarFichas(){
      TP.guardar(fichas);
      var r = api.record("blackjack", fichas, false);
      return r;
    }
    function repartir(){
      if (apuesta < 10 || apuesta > fichas) return;
      jugador = [sacar(), sacar()]; crupier = [sacar(), Object.assign(sacar(), { oculta: true })]; doblada = false;
      fase = "jugar";
      var tj = total(jugador).t;
      var real = crupier.map(function(c){ return { v: c.v, p: c.p, color: c.color }; });
      if (tj === 21 || total(real).t === 21) return resolver();
      estadoEl.textContent = "¿Pides otra carta o te plantas?";
      pintar();
    }
    function pedir(){ jugador.push(sacar()); if (total(jugador).t > 21) return resolver(); if (total(jugador).t === 21) return plantarse(); pintar(); }
    function doblar(){ apuesta *= 2; doblada = true; jugador.push(sacar()); if (total(jugador).t > 21) return resolver(); plantarse(); }
    function plantarse(){
      crupier.forEach(function(c){ delete c.oculta; });
      while (total(crupier).t < 17) crupier.push(sacar());
      resolver();
    }
    function resolver(){
      crupier.forEach(function(c){ delete c.oculta; });
      var tj = total(jugador).t, tc = total(crupier).t;
      var bjJ = tj === 21 && jugador.length === 2, bjC = tc === 21 && crupier.length === 2, gana = 0, texto;
      if (tj > 21){ gana = -apuesta; texto = "Te pasaste de 21. Pierdes " + api.miles(apuesta) + "."; }
      else if (bjJ && !bjC){ gana = Math.floor(apuesta * 1.5); texto = "¡Blackjack! Ganas " + api.miles(gana) + "."; }
      else if (bjC && !bjJ){ gana = -apuesta; texto = "Blackjack del crupier. Pierdes " + api.miles(apuesta) + "."; }
      else if (tc > 21){ gana = apuesta; texto = "El crupier se pasó. Ganas " + api.miles(apuesta) + "."; }
      else if (tj > tc){ gana = apuesta; texto = "¡Ganas " + api.miles(apuesta) + "!"; }
      else if (tj < tc){ gana = -apuesta; texto = "Gana el crupier. Pierdes " + api.miles(apuesta) + "."; }
      else texto = "Empate: recuperas tu apuesta.";
      fichas += gana;
      if (doblada) apuesta = Math.floor(apuesta / 2);
      apuesta = Math.min(apuesta, fichas);
      var r = guardarFichas();
      fase = "fin";
      estadoEl.textContent = texto + (fichas < 10 ? " Te quedaste sin TukiPoints." : "");
      pintar();
      if (r.mejora && fichas > INICIAL) { if (r.nuevo) api.aviso("¡Nuevo máximo: " + TP.texto(fichas) + "!"); api.ofrecerGuardar("blackjack", fichas); }
    }
    function tecla(e){
      if (e.target.tagName === "INPUT") return;
      if (fase === "jugar"){ if (e.key === "p" || e.key === "P") pedir(); else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); plantarse(); } }
      else if (e.key === "Enter" && apuesta >= 10 && apuesta <= fichas) { e.preventDefault(); repartir(); }
    }
    document.addEventListener("keydown", tecla);
    nuevoMazo();
    estadoEl.textContent = fichas === INICIAL ? "Elige tu apuesta y reparte. Empiezas con " + TP.texto(INICIAL) + "." : "Elige tu apuesta y reparte.";
    pintar();
    return function(){ document.removeEventListener("keydown", tecla); };
  }
});
