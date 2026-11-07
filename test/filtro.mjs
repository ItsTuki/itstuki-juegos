// Prueba del filtro de nombres. Uso: node test/filtro.mjs
import { nombreOfensivo } from "../worker/filtro.js";

const bloquear = [
  "Nigger", "N1gg3r", "weon", "WEEEON", "aweonao", "Huevón", "conchetumare", "CTM", "culiao",
  "p u t a", "p.u.t.a", "Put4", "putamadre", "maricón", "mierda", "Verga", "pico", "p1c0",
  "fuck you", "Fvck", "bitch", "Hitler", "nazi", "hijo de puta", "Ql", "wn", "chupalo", "pendejo",
];
const permitir = [
  "Tuki", "Ángel", "AHHMEPROYECTO", "Vergara", "Picolo", "Computadora", "Yoshitaka", "Ana Zion",
  "Nicolás", "Matías", "Sebastián", "Pipe_99", "Martina 2048", "Camilo.dev", "Escultor",
  "Catalina", "Picardía", "Josefa", "Pepe", "Concha", "Tuki Pro", "Benjamín", "x_Tomi_x",
];

let fallas = 0;
for (const n of bloquear) if (!nombreOfensivo(n)) { console.log("FALLA  debía bloquear:", n); fallas++; }
for (const n of permitir) if (nombreOfensivo(n)) { console.log("FALLA  debía permitir:", n); fallas++; }
console.log(`${bloquear.length + permitir.length - fallas}/${bloquear.length + permitir.length} pruebas OK`);
process.exit(fallas ? 1 : 0);
