import { readFile } from "node:fs/promises";
const env = Object.fromEntries((await readFile(".env.local","utf8")).split("\n").map(l=>l.trim()).filter(l=>l&&!l.startsWith("#")&&l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1)]}));
const U=env.NEXT_PUBLIC_SUPABASE_URL, K=env.SUPABASE_SERVICE_ROLE_KEY;
const cab={apikey:K,Authorization:`Bearer ${K}`,"Content-Type":"application/json",Prefer:"return=representation"};

/**
 * El catálogo en «Editorial»: foto ancha, titular serif, precio abajo.
 * De los trece diseños es el que más se parece a su carta impresa —
 * serif de interletrado abierto y mucho aire.
 *
 * `plan: "pro"` porque Editorial es un diseño Pro. Es nuestra demo, y
 * lo que se le enseña a un negocio tiene que ser lo que va a tener.
 */
const diseno = {
  menuAjustes: {
    plantilla: "editorial",
    tema: "marca",
    fondo: "#f4f1ed",
    tinta: "#2b2723",
    acento: "#3d7a6d",
    fuente: "editorial",
    titulo: "serif",
    foto: "ancha",
    disposicion: "revista",
    separador: "ninguno",
    precio: "bajo",
    aire: "amplio",
    portada: "completa",
  },
};

const r = await fetch(`${U}/rest/v1/solutions_negocios?slug=eq.zuccherino`, {
  method: "PATCH", headers: cab,
  body: JSON.stringify({ diseno, plan: "pro" }),
});
const j = await r.json();
console.log(r.status, j[0]?.plan, JSON.stringify(j[0]?.diseno?.menuAjustes?.plantilla));
