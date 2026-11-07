/* Snake: come estrellas, crece y no choques. 10 puntos por estrella; acelera de a poco. */
Juegos.registrar({
  id: "snake",
  nombre: "Snake",
  descripcion: "Come estrellas, crece y no te muerdas la cola.",
  icono: "∿",
  tablas: [{ clave: "snake", nombre: "Snake", menorEsMejor: false }],
  resumen: function(api){ var r = api.leer("record:snake", null); return r === null ? null : "Récord: " + api.miles(r); },
  montar: function(cont, api){
    "use strict";
    var N = 20, el = api.el;
    var lienzo = el("canvas", { clase: "lienzo-snake", width: 400, height: 400, role: "img", "aria-label": "Tablero de Snake" });
    var puntosEl = el("b", { texto: "0" }), recordEl = el("b", { texto: api.miles(api.leer("record:snake", 0)) });
    var capa = el("div", { clase: "capa-juego" });
    var marco = el("div", { clase: "marco-lienzo" }, [lienzo, capa]);
    cont.appendChild(el("div", { clase: "marcador" }, [ el("span", null, ["Puntos ", puntosEl]), el("span", null, ["Récord ", recordEl]) ]));
    cont.appendChild(marco);
    cont.appendChild(el("p", { clase: "ayuda-juego", texto: "Flechas o WASD para moverte, espacio para pausar. En el celular, desliza sobre el tablero o usa los botones." }));
    cont.appendChild(api.cruceta(girar));

    var ctx = lienzo.getContext("2d"), colores = {};
    function leerColores(){
      var cs = getComputedStyle(document.documentElement);
      colores = { fondo: cs.getPropertyValue("--panel-2").trim(), rejilla: cs.getPropertyValue("--borde").trim(),
        cuerpo: cs.getPropertyValue("--acento").trim(), cabeza: cs.getPropertyValue("--rosa").trim(), comida: cs.getPropertyValue("--chispa").trim() };
    }
    leerColores();

    var serpiente, dir, cola, comida, puntos, estado, ultimo, intervalo, raf;
    function nueva(){
      serpiente = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
      dir = { x: 1, y: 0 }; cola = []; puntos = 0; intervalo = 140;
      puntosEl.textContent = "0"; ponerComida(); estado = "listo";
      mostrarCapa("Snake", "Presiona una flecha o el botón para empezar.", "Jugar");
      dibujar();
    }
    function ponerComida(){
      var libres = [];
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!serpiente.some(function(s){ return s.x === x && s.y === y; })) libres.push({ x: x, y: y });
      comida = libres[Math.floor(Math.random() * libres.length)];
    }
    var DIRS = { arriba: { x: 0, y: -1 }, abajo: { x: 0, y: 1 }, izquierda: { x: -1, y: 0 }, derecha: { x: 1, y: 0 } };
    function girar(nombre){
      var d = DIRS[nombre]; if (!d) return;
      if (estado === "listo" || estado === "fin") { if (estado === "fin") nueva(); empezar(); }
      if (estado === "pausa") reanudar();
      var ref = cola.length ? cola[cola.length - 1] : dir;
      if (d.x === -ref.x && d.y === -ref.y) return;
      if (d.x === ref.x && d.y === ref.y) return;
      if (cola.length < 3) cola.push(d);
    }
    function empezar(){ estado = "jugando"; ocultarCapa(); ultimo = performance.now(); raf = requestAnimationFrame(bucle); }
    function pausar(){ if (estado !== "jugando") return; estado = "pausa"; cancelAnimationFrame(raf); mostrarCapa("Pausa", "Toca para seguir.", "Seguir"); }
    function reanudar(){ if (estado !== "pausa") return; empezar(); }
    function bucle(t){
      if (estado !== "jugando") return;
      if (t - ultimo >= intervalo){ ultimo = t; paso(); }
      raf = requestAnimationFrame(bucle);
    }
    function paso(){
      if (cola.length) dir = cola.shift();
      var cab = { x: serpiente[0].x + dir.x, y: serpiente[0].y + dir.y };
      var come = cab.x === comida.x && cab.y === comida.y;
      var cuerpo = come ? serpiente : serpiente.slice(0, -1);
      if (cab.x < 0 || cab.y < 0 || cab.x >= N || cab.y >= N || cuerpo.some(function(s){ return s.x === cab.x && s.y === cab.y; })) return terminar();
      serpiente.unshift(cab);
      if (come){
        puntos += 10; puntosEl.textContent = api.miles(puntos);
        api.sonido.efecto("comer");
        intervalo = Math.max(65, intervalo - 3);
        if (serpiente.length === N * N) return terminar(true);
        ponerComida();
      } else serpiente.pop();
      dibujar();
    }
    function terminar(gano){
      estado = "fin"; cancelAnimationFrame(raf); dibujar();
      var r = api.record("snake", puntos, false);
      api.sonido.efecto(gano ? "grande" : r.nuevo ? "record" : "morir");
      recordEl.textContent = api.miles(r.record);
      mostrarCapa(gano ? "¡Llenaste el tablero!" : "Fin del juego", api.miles(puntos) + " puntos" + (r.nuevo ? " · ¡nuevo récord!" : ""), "Otra vez");
      if (puntos > 0) api.ofrecerGuardar("snake", puntos);
    }
    function dibujar(){
      var c = lienzo.width / N;
      ctx.fillStyle = colores.fondo; ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.globalAlpha = .35; ctx.fillStyle = colores.rejilla;
      for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) if ((i + j) % 2 === 0) ctx.fillRect(i * c, j * c, c, c);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colores.comida; ctx.font = Math.floor(c * .95) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("★", comida.x * c + c / 2, comida.y * c + c / 2 + 1);
      serpiente.forEach(function(s, i){
        ctx.fillStyle = i === 0 ? colores.cabeza : colores.cuerpo;
        ctx.fillRect(s.x * c + 1, s.y * c + 1, c - 2, c - 2);
      });
    }
    function mostrarCapa(titulo, texto, boton){
      capa.textContent = ""; capa.hidden = false;
      capa.appendChild(el("b", { texto: titulo })); capa.appendChild(el("p", { texto: texto }));
      capa.appendChild(el("button", { type: "button", clase: "boton", texto: boton, onclick: function(){
        if (estado === "pausa") reanudar(); else { if (estado === "fin") nueva(); empezar(); }
      } }));
    }
    function ocultarCapa(){ capa.hidden = true; }

    function tecla(e){
      if (e.target.tagName === "INPUT") return;
      var d = api.TECLAS[e.key];
      if (d){ e.preventDefault(); girar(d); }
      else if (e.key === " " || e.key === "p" || e.key === "P"){ e.preventDefault(); if (estado === "jugando") pausar(); else if (estado === "pausa") reanudar(); else { if (estado === "fin") nueva(); empezar(); } }
    }
    function visibilidad(){ if (document.hidden) pausar(); }
    function tema(){ leerColores(); dibujar(); }
    api.deslizar(marco, girar);
    document.addEventListener("keydown", tecla);
    document.addEventListener("visibilitychange", visibilidad);
    window.addEventListener("cambio-tema", tema);
    nueva();

    return function(){
      estado = "fin"; cancelAnimationFrame(raf);
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("visibilitychange", visibilidad);
      window.removeEventListener("cambio-tema", tema);
    };
  }
});
