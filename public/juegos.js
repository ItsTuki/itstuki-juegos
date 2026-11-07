/* Sala de juegos · núcleo compartido
   Cada juego se registra con:
     Juegos.registrar({
       id, nombre, descripcion, icono,
       tablas: [{ clave, nombre, menorEsMejor, formato }],   // tablas de posiciones del juego (opcional)
       resumen(api) -> texto para la tarjeta de la sala,
       montar(contenedor, api) -> función para desmontar
     })
   La URL #id abre el juego. */
var Juegos = (function(){
  "use strict";
  var lista = [], desmontar = null, juegoActual = null;
  var $ = function(s, r){ return (r || document).querySelector(s); };

  function el(tag, attrs, hijos){
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k){
      var v = attrs[k]; if (v === null || v === undefined || v === false) return;
      if (k === "texto") n.textContent = v;
      else if (k === "clase") n.className = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    (hijos || []).forEach(function(h){ if (h !== null && h !== undefined && h !== false) n.appendChild(typeof h === "string" ? document.createTextNode(h) : h); });
    return n;
  }

  function aviso(texto){
    var caja = $("#avisos"), a = el("div", { clase: "aviso", texto: texto });
    caja.appendChild(a); setTimeout(function(){ a.remove(); }, 2600);
  }

  function miles(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

  /* ---------- Datos locales ---------- */
  function leer(clave, porDefecto){
    try { var v = localStorage.getItem("juegos:" + clave); return v === null ? porDefecto : JSON.parse(v); } catch (e) { return porDefecto; }
  }
  function guardar(clave, valor){ try { localStorage.setItem("juegos:" + clave, JSON.stringify(valor)); } catch (e) {} }
  function record(clave, puntos, menorEsMejor){
    var previo = leer("record:" + clave, null);
    var mejora = previo === null || (menorEsMejor ? puntos < previo : puntos > previo);
    if (mejora) guardar("record:" + clave, puntos);
    return { record: mejora ? puntos : previo, nuevo: mejora && previo !== null };
  }

  /* ---------- Controles táctiles ---------- */
  function deslizar(elemento, cb){
    var x0 = 0, y0 = 0, activo = false;
    elemento.addEventListener("touchstart", function(e){ if (e.touches.length !== 1) return; activo = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    elemento.addEventListener("touchmove", function(e){ if (activo) e.preventDefault(); }, { passive: false });
    elemento.addEventListener("touchend", function(e){
      if (!activo) return; activo = false;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "derecha" : "izquierda") : (dy > 0 ? "abajo" : "arriba"));
    });
  }
  function cruceta(cb){
    function b(dir, flecha, etiqueta){ return el("button", { type: "button", clase: "cruz-" + dir, "aria-label": etiqueta, texto: flecha, onclick: function(){ cb(dir); } }); }
    return el("div", { clase: "cruceta", role: "group", "aria-label": "Controles" }, [
      b("arriba", "▲", "Arriba"), b("izquierda", "◀", "Izquierda"), b("derecha", "▶", "Derecha"), b("abajo", "▼", "Abajo")
    ]);
  }
  var TECLAS = { ArrowUp: "arriba", ArrowDown: "abajo", ArrowLeft: "izquierda", ArrowRight: "derecha",
    w: "arriba", s: "abajo", a: "izquierda", d: "derecha", W: "arriba", S: "abajo", A: "izquierda", D: "derecha" };

  /* ---------- Tabla de posiciones (API del Worker en /api/) ---------- */
  var cacheTablas = {};
  function cargarTabla(clave, forzar){
    if (!forzar && cacheTablas[clave] && Date.now() - cacheTablas[clave].t < 30000) return Promise.resolve(cacheTablas[clave].d);
    return fetch("/api/posiciones?juego=" + encodeURIComponent(clave), { cache: "no-store" })
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d){ cacheTablas[clave] = { t: Date.now(), d: d.filas || [] }; return cacheTablas[clave].d; });
  }
  function enviarPuntaje(clave, nombre, puntos){
    return fetch("/api/puntajes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ juego: clave, nombre: nombre, puntos: puntos }) })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || "No se pudo guardar el puntaje."); return d; }); });
  }

  function definicion(clave){
    for (var i = 0; i < lista.length; i++) for (var j = 0; j < (lista[i].tablas || []).length; j++) if (lista[i].tablas[j].clave === clave) return lista[i].tablas[j];
    return { clave: clave, nombre: clave, formato: miles };
  }

  /* Pinta la tabla de una clave dentro de "caja" */
  function pintarTabla(caja, clave, destacar){
    var def = definicion(clave), fmt = def.formato || miles;
    caja.textContent = "";
    var ol = el("ol", { clase: "lista-posiciones", "aria-label": "Posiciones de " + def.nombre });
    caja.appendChild(el("div", { clase: "cargando-tabla", texto: "Cargando posiciones…" }));
    cargarTabla(clave, !!destacar).then(function(filas){
      caja.textContent = "";
      if (!filas.length){
        caja.appendChild(el("p", { clase: "tabla-vacia", texto: "Nadie ha anotado todavía. ¡El primer lugar está libre!" }));
        return;
      }
      filas.forEach(function(f, i){
        var esYo = destacar && f.nombre === destacar.nombre && f.puntos === destacar.puntos;
        ol.appendChild(el("li", { clase: esYo ? "yo" : null }, [
          el("span", { clase: "lugar", texto: i < 3 ? ["①", "②", "③"][i] : String(i + 1) }),
          el("span", { clase: "quien", texto: f.nombre }),
          el("b", { texto: fmt(f.puntos) })
        ]));
      });
      caja.appendChild(ol);
    }).catch(function(){
      caja.textContent = "";
      caja.appendChild(el("p", { clase: "tabla-vacia", texto: "La tabla no está disponible ahora. Tus récords siguen guardados en este navegador." }));
    });
  }

  /* Panel lateral del juego: pestañas por tabla + formulario para guardar */
  var panel = { clave: null, pendiente: null };
  function pintarPanel(juego){
    var cont = $("#posiciones-juego"); cont.textContent = "";
    var tablas = juego.tablas || [];
    $(".panel-posiciones").hidden = !tablas.length;
    if (!tablas.length) return;
    if (!panel.clave || !tablas.some(function(t){ return t.clave === panel.clave; })) panel.clave = tablas[0].clave;
    if (tablas.length > 1){
      cont.appendChild(el("div", { clase: "pildoras", role: "group", "aria-label": "Tabla" }, tablas.map(function(t){
        return el("button", { type: "button", "aria-pressed": t.clave === panel.clave ? "true" : "false", texto: t.nombre,
          onclick: function(){ panel.clave = t.clave; pintarPanel(juego); } });
      })));
    }
    var miRecord = leer("record:" + panel.clave, null), def = definicion(panel.clave);
    cont.appendChild(el("p", { clase: "mi-record", texto: "Tu récord: " + (miRecord === null ? "—" : (def.formato || miles)(miRecord)) }));
    if (panel.pendiente && panel.pendiente.clave === panel.clave) cont.appendChild(formularioGuardar(juego, panel.pendiente));
    var caja = el("div", { clase: "caja-tabla" }); cont.appendChild(caja);
    pintarTabla(caja, panel.clave, panel.ultimo && panel.ultimo.clave === panel.clave ? panel.ultimo : null);
  }

  function formularioGuardar(juego, p){
    var def = definicion(p.clave);
    var input = el("input", { id: "nombre-puntaje", type: "text", maxlength: "16", autocomplete: "nickname", required: true, value: leer("nombre", "") || "", placeholder: "Tu nombre o apodo" });
    var form = el("form", { clase: "guardar-puntaje" }, [
      el("p", null, [ "Hiciste ", el("b", { texto: (def.formato || miles)(p.puntos) }), ". ¿Lo anotas en la tabla?" ]),
      el("div", { clase: "campo" }, [ el("label", { for: "nombre-puntaje", texto: "Nombre (2 a 16 letras)" }), input ]),
      el("div", { clase: "fila-botones" }, [
        el("button", { clase: "boton chico", type: "submit", texto: "Anotar" }),
        el("button", { clase: "boton secundario chico", type: "button", texto: "No, gracias", onclick: function(){ panel.pendiente = null; pintarPanel(juego); } })
      ])
    ]);
    form.addEventListener("submit", function(e){
      e.preventDefault();
      var nombre = input.value.trim().replace(/\s+/g, " ");
      if (nombre.length < 2) { aviso("Escribe al menos 2 letras."); input.focus(); return; }
      guardar("nombre", nombre);
      var boton = form.querySelector('[type="submit"]'); boton.disabled = true; boton.textContent = "Anotando…";
      enviarPuntaje(p.clave, nombre, p.puntos).then(function(r){
        panel.ultimo = { clave: p.clave, nombre: r.nombre || nombre, puntos: p.puntos };
        panel.pendiente = null;
        aviso(r.posicion ? "¡Quedaste en el lugar " + r.posicion + "!" : "Puntaje anotado");
        pintarPanel(juego);
      }).catch(function(err){ aviso(err.message); boton.disabled = false; boton.textContent = "Anotar"; });
    });
    setTimeout(function(){ if (window.matchMedia("(min-width: 900px)").matches) input.focus({ preventScroll: true }); }, 50);
    return form;
  }

  /* Lo llaman los juegos al terminar una partida */
  function ofrecerGuardar(clave, puntos){
    if (!juegoActual || !(puntos > 0)) return;
    panel.clave = clave; panel.pendiente = { clave: clave, puntos: puntos };
    pintarPanel(juegoActual);
    if (window.matchMedia("(max-width: 899px)").matches) $(".panel-posiciones").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function mostrarTabla(clave){ if (juegoActual){ panel.clave = clave; pintarPanel(juegoActual); } }

  var api = { el: el, aviso: aviso, miles: miles, leer: leer, guardar: guardar, record: record, deslizar: deslizar, cruceta: cruceta, TECLAS: TECLAS,
    ofrecerGuardar: ofrecerGuardar, mostrarTabla: mostrarTabla };

  function registrar(juego){ lista.push(juego); }

  /* ---------- Sala ---------- */
  var tablaSala = null;
  function pintarNav(){
    var nav = $("#nav-juegos"); nav.textContent = "";
    lista.forEach(function(j){ nav.appendChild(el("a", { href: "#" + j.id, "data-id": j.id, texto: j.nombre })); });
  }
  function pintarSala(){
    var ul = $("#tarjetas-juego"); ul.textContent = "";
    lista.forEach(function(j){
      ul.appendChild(el("li", null, [ el("a", { clase: "tarjeta-juego", href: "#" + j.id }, [
        el("span", { clase: "icono-juego icono-" + j.id, "aria-hidden": "true", texto: j.icono }),
        el("span", { clase: "nombre-juego", texto: j.nombre }),
        el("span", { clase: "desc-juego", texto: j.descripcion }),
        el("span", { clase: "record-juego", texto: (j.resumen && j.resumen(api)) || "sin récord todavía" })
      ]) ]));
    });
    var todas = []; lista.forEach(function(j){ (j.tablas || []).forEach(function(t){ todas.push(t); }); });
    var cont = $("#posiciones-sala"); cont.textContent = "";
    if (!todas.length) return;
    if (!tablaSala) tablaSala = todas[0].clave;
    cont.appendChild(el("div", { clase: "pildoras", role: "group", "aria-label": "Elegir juego" }, todas.map(function(t){
      return el("button", { type: "button", "aria-pressed": t.clave === tablaSala ? "true" : "false", texto: t.nombre,
        onclick: function(){ tablaSala = t.clave; pintarSala(); } });
    })));
    var caja = el("div", { clase: "caja-tabla" }); cont.appendChild(caja);
    pintarTabla(caja, tablaSala);
  }

  function abrir(){
    var id = decodeURIComponent(location.hash.slice(1));
    var juego = lista.filter(function(j){ return j.id === id; })[0];
    if (desmontar){ try { desmontar(); } catch (e) {} desmontar = null; }
    Array.prototype.forEach.call(document.querySelectorAll("#nav-juegos a"), function(a){
      if (juego && a.dataset.id === juego.id) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (!juego){
      juegoActual = null;
      $("#juego").hidden = true; $("#sala").hidden = false;
      document.title = "✦ Sala de juegos · ItsTuki ✦";
      pintarSala();
      return;
    }
    juegoActual = juego; panel = { clave: null, pendiente: null };
    $("#sala").hidden = true; $("#juego").hidden = false;
    $("#titulo-juego").textContent = "~ " + juego.nombre.toLowerCase();
    document.title = juego.nombre + " · Sala de juegos";
    var c = $("#contenedor-juego"); c.textContent = "";
    desmontar = juego.montar(c, api) || null;
    pintarPanel(juego);
    $("#escenario").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* Contador de visitas compartido con itstuki.cl (una por persona y día) */
  function contarVisita(){
    fetch("/api/visitas", { method: "POST", cache: "no-store" })
      .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d){
        var mini = $("#contador-mini"); mini.textContent = "";
        String(d.total).padStart(6, "0").split("").forEach(function(c){ mini.appendChild(el("span", { texto: c })); });
        $("#visitas-texto").textContent = miles(d.total) + (d.total === 1 ? " visita" : " visitas") + " · hoy " + miles(d.hoy);
        $("#pie-visitas").hidden = false;
      })
      .catch(function(){});
  }

  function iniciar(){
    var b = $("#cambiar-tema");
    function etiqueta(){ b.setAttribute("aria-label", document.documentElement.dataset.tema === "noche" ? "Cambiar a modo día" : "Cambiar a modo noche"); }
    b.addEventListener("click", function(){
      var t = document.documentElement.dataset.tema === "noche" ? "dia" : "noche";
      document.documentElement.dataset.tema = t;
      try { localStorage.setItem("tema", t); } catch (e) {}
      etiqueta();
      window.dispatchEvent(new Event("cambio-tema"));
    });
    etiqueta();
    window.addEventListener("hashchange", abrir);
    pintarNav();
    abrir();
    contarVisita();
  }

  return { registrar: registrar, iniciar: iniciar, api: api };
})();
