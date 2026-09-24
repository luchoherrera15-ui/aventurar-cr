/**
 * Carga créditos de CELEBRAR a una cuenta, a mano (regalo o ajuste),
 * mientras el pago con tarjeta no está conectado.
 *
 *   node scripts/celebrar-acreditar-creditos.mjs <correo|uuid> <cantidad> [concepto] [referencia]
 *
 * Usa la service role de .env.local y la RPC `celebrar_acreditar_creditos`
 * (0245): si se repite la misma referencia no acredita dos veces.
 */
import { readFileSync } from "node:fs";

const [correo, cantidadCruda, concepto = "Créditos de regalo", referencia] = process.argv.slice(2);
const cantidad = Number(cantidadCruda);
if (!correo || !Number.isInteger(cantidad) || cantidad <= 0) {
  console.error("Uso: node scripts/celebrar-acreditar-creditos.mjs <correo> <cantidad> [concepto] [referencia]");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// El id de la cuenta: un uuid directo, o el correo buscado página por
// página en la Admin API de Auth (Bookea tiene más de 200 cuentas).
let usuario = /^[0-9a-f-]{36}$/i.test(correo) ? { id: correo } : null;
for (let pagina = 1; !usuario && pagina <= 50; pagina++) {
  const busqueda = await fetch(`${url}/auth/v1/admin/users?page=${pagina}&per_page=200`, { headers: H });
  if (!busqueda.ok) {
    console.error("No se pudo listar usuarios:", busqueda.status, await busqueda.text());
    process.exit(1);
  }
  const { users } = await busqueda.json();
  if (!users?.length) break;
  usuario = users.find((u) => u.email?.toLowerCase() === correo.toLowerCase()) ?? null;
}
if (!usuario) {
  console.error("No hay ninguna cuenta con ese correo.");
  process.exit(1);
}

const r = await fetch(`${url}/rest/v1/rpc/celebrar_acreditar_creditos`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ p_owner: usuario.id, p_cantidad: cantidad, p_tipo: "regalo", p_concepto: concepto, p_referencia: referencia ?? null }),
});
const texto = await r.text();
if (!r.ok) {
  console.error("Falló:", r.status, texto);
  process.exit(1);
}
console.log(texto === "true" ? `Acreditados ${cantidad} créditos a ${correo}.` : `Referencia repetida: no se acreditó nada.`);
