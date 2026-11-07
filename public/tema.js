/* Aplica el tema guardado (o el del sistema) antes de pintar la página. */
(function(){
  var t;
  try { t = localStorage.getItem("tema"); } catch (e) {}
  if (t !== "dia" && t !== "noche") t = matchMedia("(prefers-color-scheme: dark)").matches ? "noche" : "dia";
  document.documentElement.dataset.tema = t;
})();
