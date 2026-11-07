// Filtro de nombres groseros para la tabla de posiciones.
// Se usa al anotar (rechaza el nombre) y al mostrar la tabla (oculta los que ya estaban guardados).
//
// Cómo compara: pasa el nombre a minúsculas, quita tildes, cambia números por letras (p0t0 → poto,
// 4 → a, 3 → e…) y junta letras repetidas (weeeon → weon). Si el nombre viene separado letra por
// letra ("p u t a", "p.u.t.a"), también prueba la versión junta.
//
// Hay dos listas para no bloquear nombres inocentes:
// - DENTRO: raíces que casi nunca aparecen dentro de una palabra normal. Se buscan en cualquier parte.
// - INICIO: palabras cortas que sí pueden ser parte de otra (puta → computadora, verga → Vergara).
//   Solo cuentan si la palabra del nombre empieza así; las marcadas con "=" tienen que ser exactas.
//
// Para agregar una palabra, escríbela tal cual (con tildes o letras repetidas da lo mismo).

const DENTRO = [
  // Chile y Latinoamérica
  "conchetum", "conchesum", "conchasum", "conchatum", "conchadesum",
  "culiao", "culiado", "culiada", "qliao", "kuliao", "weon", "hueon", "huevon", "guevon",
  "maricon", "maraco", "mierda", "pendej", "cabron", "chucha", "malparid", "hijodeput",
  "hijueput", "gonorrea", "chupal", "chupame", "pajero", "pajera", "imbecil", "estupid",
  "idiota", "retrasad", "pedofil", "violador",
  // Inglés
  "nigger", "nigga", "faggot", "fuck", "fvck", "bitch", "pussy", "asshole", "cunt",
  "whore", "porn", "hitler", "retard", "motherf",
];

const INICIO = [
  "puta", "puto", "marica", "joder", "jodete", "folla", "shit", "slut",
  "=verga", "=vergas", "=vergon", "=pico", "=picos", "=pene", "=penes", "=pija", "=pinga",
  "=culo", "=culos", "=poto", "=caca", "=sexo", "=perra", "=perras", "=zorra", "=zorras",
  "=nazi", "=nazis", "=dick", "=cock", "=fag", "=rape", "=kys",
  "=fck", "=fuk", "=ctm", "=csm", "=ctmr", "=qlo", "=ql", "=wn", "=hdp", "=ptm",
];

const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", 8: "b", "@": "a", $: "s" };

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0134578@$]/g, (c) => LEET[c])
    .replace(/(.)\1+/g, "$1");
}

const RAICES_DENTRO = DENTRO.map(normalizar);
const RAICES_INICIO = INICIO.map((p) => (p[0] === "=" ? { exacta: true, raiz: normalizar(p.slice(1)) } : { exacta: false, raiz: normalizar(p) }));

export function nombreOfensivo(nombre) {
  const palabras = normalizar(nombre).split(/[^a-z]+/).filter(Boolean);
  if (!palabras.length) return false;
  const candidatas = palabras.slice();
  // "p u t a", "p.u.t.a", "put a": también se revisa todo junto
  if (palabras.length > 1 && palabras.some((p) => p.length <= 2)) candidatas.push(palabras.join(""));
  return candidatas.some(
    (p) =>
      RAICES_DENTRO.some((r) => p.includes(r)) ||
      RAICES_INICIO.some(({ exacta, raiz }) => (exacta ? p === raiz : p.startsWith(raiz)))
  );
}
