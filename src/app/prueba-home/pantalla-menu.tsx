"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { fmtMoneda } from "@/lib/monedas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL MENÚ DIGITAL, EN USO
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «que tenga la foto de portada arriba,
 * en el centro la imagen, abajo unas categorías —plato fuerte, postre,
 * bebidas— y abajo los platos, que se puedan ordenar. Que se vea
 * demostrándose».
 *
 * Y antes, con take.app al lado: «se ve como si se estuviera
 * interactuando con la aplicación directamente en el mockup».
 *
 * ── POR QUÉ ESTA PANTALLA SÍ SE MUEVE SOLA ──────────────────────────
 *
 * No es una captura ni un dibujo quieto: cambia de categoría, agrega un
 * plato al carrito y la barra de abajo actualiza el total. Eso es lo
 * que hace que se lea como «alguien está usando esto» en vez de «acá
 * hay una foto de una app».
 *
 * El guion es corto a propósito —cuatro momentos— y vuelve a empezar.
 * Un guion largo obliga a mirar diez segundos para entender y nadie
 * mira un mockup diez segundos.
 *
 * `prefers-reduced-motion` lo deja quieto con el carrito ya armado: se
 * pierde el movimiento, no la información.
 *
 * ── ⚠️ LAS FOTOS SON EL AGUJERO ─────────────────────────────────────
 *
 * Hoy el sistema entero tiene UNA foto de plato (el croissant, que
 * subió el banco de pruebas). Los demás ítems salen con su tarjeta
 * tipográfica, que es EXACTAMENTE lo que hace el producto cuando un
 * negocio no subió foto — así que no es una mentira, es el caso real
 * más común. Pero con cuatro o cinco fotos de comida esta pantalla
 * pasa de correcta a vendedora. Está pedido.
 */

const FOTO_CROISSANT =
  "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/507cd757-1ac1-4174-2b58-1e70ed856800/gallery";

const PORTADA =
  "https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/linksy-hero-restaurante/gallery";

const VERDE = "#2f6b4f";
const CREMA = "#f7f4ec";

type Plato = {
  nombre: string;
  detalle: string;
  precio: number;
  foto?: string;
};

/**
 * ⚠️ CUATRO POR CATEGORÍA, Y NO ES CAPRICHO.
 *
 * Con dos ítems la lista dejaba un tercio de pantalla en blanco y el
 * mockup se leía como una app vacía — justo lo contrario de lo que
 * tiene que transmitir. Cuatro llenan el alto del teléfono sin que haya
 * que hacer scroll, que es como se ve un menú de verdad.
 */
const CATEGORIAS: { id: string; label: string; platos: Plato[] }[] = [
  {
    id: "cafes",
    label: "Cafés",
    platos: [
      { nombre: "Cold brew", detalle: "12 h de extracción en frío", precio: 2800 },
      { nombre: "Latte", detalle: "Doble espresso con leche vaporizada", precio: 2500 },
      { nombre: "Matcha latte", detalle: "Ceremonial, leche de almendra", precio: 3200 },
      { nombre: "Flat white", detalle: "Ristretto doble", precio: 2600 },
    ],
  },
  {
    id: "comidas",
    label: "Para comer",
    platos: [
      {
        nombre: "Croissant de jamón y queso",
        detalle: "Recién horneado",
        precio: 3200,
        foto: FOTO_CROISSANT,
      },
      { nombre: "Tostada de aguacate", detalle: "Pan de masa madre", precio: 4500 },
      { nombre: "Bagel de salmón", detalle: "Con queso crema y alcaparras", precio: 5200 },
      { nombre: "Sándwich caprese", detalle: "Pesto de la casa", precio: 4200 },
    ],
  },
  {
    id: "postres",
    label: "Postres",
    platos: [
      { nombre: "Brownie de la casa", detalle: "Con nueces", precio: 1800 },
      { nombre: "Cheesecake de matcha", detalle: "Recién hecho", precio: 2800 },
      { nombre: "Galleta de avena", detalle: "Con chocolate amargo", precio: 1400 },
      { nombre: "Tres leches", detalle: "Porción individual", precio: 2600 },
    ],
  },
];

/**
 * El guion. Cada paso dice en qué categoría estamos y cuántos ítems
 * lleva el carrito; el resto se deriva.
 */
const GUION = [
  { cat: 0, carrito: 0, agregado: -1, espera: 1600 },
  { cat: 1, carrito: 0, agregado: -1, espera: 1500 },
  { cat: 1, carrito: 1, agregado: 0, espera: 1900 },
  { cat: 2, carrito: 2, agregado: 0, espera: 2600 },
];

export default function PantallaMenu() {
  const [i, setI] = useState(0);
  const [quieto, setQuieto] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setQuieto(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);

  useEffect(() => {
    if (quieto) return;
    reloj.current = setTimeout(
      () => setI((n) => (n + 1) % GUION.length),
      GUION[i].espera,
    );
    return () => {
      if (reloj.current) clearTimeout(reloj.current);
      reloj.current = null;
    };
  }, [i, quieto]);

  // Quieto: el último paso, con el carrito ya armado.
  const paso = quieto ? GUION[GUION.length - 1] : GUION[i];
  const cat = CATEGORIAS[paso.cat];

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ background: CREMA }}
    >
      {/* ── LA PORTADA ─────────────────────────────────────────── */}
      <div className="relative h-[128px] w-full shrink-0 overflow-hidden">
        <Image
          src={PORTADA}
          alt=""
          fill
          unoptimized
          className="object-cover"
          sizes="300px"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(20,16,12,0.72), rgba(20,16,12,0.05))",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
            style={{ background: VERDE }}
          >
            C
          </span>
          <span className="min-w-0 pb-0.5">
            <span className="block truncate text-[14px] font-extrabold leading-tight text-white">
              Casa Matcha
            </span>
            <span className="block truncate text-[9.5px] font-bold uppercase tracking-[0.1em] text-white/75">
              Menú · Escazú
            </span>
          </span>
        </div>
      </div>

      {/* ── LAS CATEGORÍAS ─────────────────────────────────────── */}
      <div className="flex shrink-0 gap-1.5 px-3 py-2.5">
        {CATEGORIAS.map((c, n) => {
          const activa = n === paso.cat;
          return (
            <span
              key={c.id}
              className="rounded-full px-2.5 py-1.5 text-[10.5px] font-extrabold transition-all duration-300"
              style={{
                background: activa ? VERDE : "rgba(20,16,12,0.06)",
                color: activa ? "#fff" : "rgba(20,16,12,0.55)",
              }}
            >
              {c.label}
            </span>
          );
        })}
      </div>

      {/* ── LOS PLATOS ─────────────────────────────────────────── */}
      <div className="flex-1 space-y-1.5 overflow-hidden px-3">
        {cat.platos.map((p, n) => {
          const enCarrito = paso.agregado === n && paso.carrito > 0;
          return (
            <div
              key={p.nombre}
              className="anim-entra flex items-center gap-2.5 rounded-[12px] bg-white p-2 shadow-[0_1px_2px_rgba(20,16,12,0.06)]"
            >
              {/* La foto, o la tarjeta tipográfica que el producto usa
                  cuando el negocio no subió ninguna. */}
              {p.foto ? (
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[9px]">
                  <Image
                    src={p.foto}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="48px"
                  />
                </span>
              ) : (
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[9px] text-[15px] font-extrabold"
                  style={{ background: "rgba(47,107,79,0.10)", color: VERDE }}
                >
                  {p.nombre.charAt(0)}
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-extrabold text-[#141210]">
                  {p.nombre}
                </span>
                <span className="block truncate text-[9.5px] text-[#141210]/50">
                  {p.detalle}
                </span>
                <span
                  className="mt-0.5 block text-[11px] font-extrabold"
                  style={{ color: VERDE }}
                >
                  {fmtMoneda(p.precio, "CRC")}
                </span>
              </span>

              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white transition-all duration-300"
                style={{
                  background: enCarrito ? VERDE : "rgba(47,107,79,0.18)",
                  transform: enCarrito ? "scale(1.1)" : "scale(1)",
                }}
              >
                {enCarrito ? "1" : "+"}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── LA BARRA DEL CARRITO ───────────────────────────────── */}
      <div className="shrink-0 p-3">
        <div
          className="flex items-center justify-between rounded-[12px] px-3.5 py-2.5 transition-all duration-500"
          style={{
            background: paso.carrito > 0 ? VERDE : "rgba(20,16,12,0.08)",
            opacity: paso.carrito > 0 ? 1 : 0.65,
          }}
        >
          <span
            className="text-[11.5px] font-extrabold"
            style={{ color: paso.carrito > 0 ? "#fff" : "rgba(20,16,12,0.45)" }}
          >
            {paso.carrito > 0
              ? `Ver mi pedido · ${paso.carrito}`
              : "Tu pedido está vacío"}
          </span>
          {paso.carrito > 0 ? (
            <span className="text-[11.5px] font-extrabold text-white">
              {fmtMoneda(paso.carrito === 1 ? 3200 : 5000, "CRC")}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
