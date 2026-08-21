"use client";

/**
 * EL ESTADO DE UNA SESIÓN DE DEMO — favoritos y reservas viven en el
 * localStorage del navegador del vendedor, nunca en la base de datos.
 *
 * Por qué localStorage y no Supabase: la demo es una vitrina comercial
 * (un vendedor mostrando el producto frente a un restaurante). Las
 * reservas TIENEN que cambiar estado para que el recorrido se sienta
 * real (la disponibilidad baja, "Mis reservas" crece), pero nada de eso
 * debe existir fuera de ese navegador. "Reiniciar demo" borra las dos
 * llaves y la sesión vuelve a cero — ese es el "reset demo".
 *
 * La disponibilidad base es DETERMINISTA (hash de slug+fecha+hora), no
 * aleatoria: así dos vendedores ven los mismos números el mismo día, un
 * refresh no baraja las mesas, y no hace falta sembrar nada.
 */

import { useSyncExternalStore } from "react";

const K_FAVORITOS = "food-demo:favoritos";
const K_RESERVAS = "food-demo:reservas";
const K_USUARIO = "food-demo:usuario";
const EVENTO = "food-demo:cambio";

/** La "cuenta" de la demo: reservar exige registrarse primero (pedido
 *  del dueño — el recorrido de venta muestra el flujo completo). Vive
 *  en localStorage como todo lo demás: nunca crea una cuenta real. */
export type UsuarioDemo = { nombre: string; correo: string; telefono: string };

export type ReservaDemo = {
  codigo: string;
  /** El nombre del usuario demo que reservó — ausente en reservas
   *  hechas antes de que existiera el registro. */
  titular?: string;
  slug: string;
  nombre: string;
  zona: string;
  fotoPrincipal: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // "18:30"
  personas: number;
  descuento: number;
  precioEstimado: number;
  precioFinal: number;
  creadaEn: string; // ISO
};

function avisar() {
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(cb: () => void): () => void {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

/* ── Favoritos ─────────────────────────────────────────────────────── */

const SIN_FAVORITOS: string[] = [];
let cacheFav: { raw: string; valor: string[] } | null = null;

function leerFavoritos(): string[] {
  if (typeof window === "undefined") return SIN_FAVORITOS;
  const raw = window.localStorage.getItem(K_FAVORITOS) ?? "[]";
  if (!cacheFav || cacheFav.raw !== raw) {
    try {
      cacheFav = { raw, valor: JSON.parse(raw) as string[] };
    } catch {
      cacheFav = { raw, valor: [] };
    }
  }
  return cacheFav.valor;
}

export function toggleFavorito(slug: string) {
  const actuales = leerFavoritos();
  const nuevos = actuales.includes(slug)
    ? actuales.filter((s) => s !== slug)
    : [...actuales, slug];
  window.localStorage.setItem(K_FAVORITOS, JSON.stringify(nuevos));
  avisar();
}

/** Los slugs favoritos de esta sesión — [] durante SSR/hidratación. */
export function useFavoritosDemo(): string[] {
  return useSyncExternalStore(suscribir, leerFavoritos, () => SIN_FAVORITOS);
}

/* ── Reservas ──────────────────────────────────────────────────────── */

const SIN_RESERVAS: ReservaDemo[] = [];
let cacheRes: { raw: string; valor: ReservaDemo[] } | null = null;

function leerReservas(): ReservaDemo[] {
  if (typeof window === "undefined") return SIN_RESERVAS;
  const raw = window.localStorage.getItem(K_RESERVAS) ?? "[]";
  if (!cacheRes || cacheRes.raw !== raw) {
    try {
      cacheRes = { raw, valor: JSON.parse(raw) as ReservaDemo[] };
    } catch {
      cacheRes = { raw, valor: [] };
    }
  }
  return cacheRes.valor;
}

export function crearReserva(datos: Omit<ReservaDemo, "codigo" | "creadaEn">): ReservaDemo {
  const codigo = `BK-DEMO-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const reserva: ReservaDemo = { ...datos, codigo, creadaEn: new Date().toISOString() };
  window.localStorage.setItem(K_RESERVAS, JSON.stringify([reserva, ...leerReservas()]));
  avisar();
  return reserva;
}

export function cancelarReserva(codigo: string) {
  window.localStorage.setItem(
    K_RESERVAS,
    JSON.stringify(leerReservas().filter((r) => r.codigo !== codigo)),
  );
  avisar();
}

/** Las reservas de esta sesión — [] durante SSR/hidratación. */
export function useReservasDemo(): ReservaDemo[] {
  return useSyncExternalStore(suscribir, leerReservas, () => SIN_RESERVAS);
}

export function buscarReserva(codigo: string): ReservaDemo | null {
  return leerReservas().find((r) => r.codigo === codigo) ?? null;
}

/* ── Usuario ───────────────────────────────────────────────────────── */

const SIN_USUARIO = null;
let cacheUsr: { raw: string; valor: UsuarioDemo | null } | null = null;

function leerUsuario(): UsuarioDemo | null {
  if (typeof window === "undefined") return SIN_USUARIO;
  const raw = window.localStorage.getItem(K_USUARIO) ?? "";
  if (!cacheUsr || cacheUsr.raw !== raw) {
    try {
      cacheUsr = { raw, valor: raw ? (JSON.parse(raw) as UsuarioDemo) : null };
    } catch {
      cacheUsr = { raw, valor: null };
    }
  }
  return cacheUsr.valor;
}

export function registrarUsuario(u: UsuarioDemo) {
  window.localStorage.setItem(K_USUARIO, JSON.stringify(u));
  avisar();
}

/** El usuario registrado de esta sesión — null durante SSR/hidratación. */
export function useUsuarioDemo(): UsuarioDemo | null {
  return useSyncExternalStore(suscribir, leerUsuario, () => SIN_USUARIO);
}

/* ── Disponibilidad ────────────────────────────────────────────────── */

/**
 * Mesas base de una franja: hash FNV-1a de slug|fecha|hora → 0..8.
 * Un ~18% de las franjas sale "agotada" (0 mesas) para que la demo
 * muestre también ese estado.
 */
export function mesasBase(slug: string, fecha: string, hora: string): number {
  const s = `${slug}|${fecha}|${hora}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (h >>> 0) % 11; // 0..10
  return n <= 1 ? 0 : Math.min(n, 8);
}

/** Mesas que quedan: la base determinista menos las reservas que esta
 *  sesión ya hizo sobre esa misma franja (1 reserva = 1 mesa). */
export function mesasDisponibles(
  reservas: ReservaDemo[],
  slug: string,
  fecha: string,
  hora: string,
): number {
  const ocupadas = reservas.filter(
    (r) => r.slug === slug && r.fecha === fecha && r.hora === hora,
  ).length;
  return Math.max(0, mesasBase(slug, fecha, hora) - ocupadas);
}

/* ── Reset ─────────────────────────────────────────────────────────── */

/** Borra favoritos, reservas y el usuario — la demo vuelve a cero. */
export function reiniciarDemo() {
  window.localStorage.removeItem(K_FAVORITOS);
  window.localStorage.removeItem(K_RESERVAS);
  window.localStorage.removeItem(K_USUARIO);
  avisar();
}
