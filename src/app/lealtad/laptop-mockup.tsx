/**
 * LA LAPTOP, DIBUJADA — mismo lenguaje visual que `TelefonoMockup`
 * (telefono-mockup.tsx: metal + bisel + vidrio con reflejo), pero en
 * formato horizontal, para el contrapunto del teléfono.
 *
 * La idea del par: el teléfono muestra lo que ve EL CLIENTE (el pase
 * en su Wallet); la laptop muestra lo que ve EL DUEÑO DEL NEGOCIO (su
 * panel). Dos dispositivos para dos audiencias — no el mismo mockup
 * repetido con otro contenido adentro. Mismos gradientes de metal y
 * el mismo `.brillo-vidrio` que ya respeta `prefers-reduced-motion`
 * (globals.css) — no es una pieza nueva, es la misma pieza en otro
 * formato.
 */
export default function LaptopMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[860px]">
      {/* La tapa: bisel metálico + cámara + pantalla */}
      <div
        className="relative rounded-t-[20px] p-[10px] pb-[16px]"
        style={{
          background:
            "linear-gradient(155deg,#6b7280 0%,#1f2937 22%,#4b5563 48%,#111827 72%,#6b7280 100%)",
          boxShadow: "0 40px 90px -26px rgba(10,18,38,.45), 0 0 0 1px rgba(255,255,255,.06)",
        }}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-[5px] h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-[#05070c]"
        />
        <div className="overflow-hidden rounded-[11px] bg-black p-[3px]">
          <div className="relative overflow-hidden rounded-[9px] bg-white">
            {children}
            <span aria-hidden className="brillo-vidrio pointer-events-none absolute inset-0 z-30" />
          </div>
        </div>
      </div>

      {/* La base: apenas asoma, para leerse "laptop" sin dibujar un
          teclado entero que nadie va a mirar. */}
      <div
        className="relative mx-auto h-[16px] rounded-b-[10px]"
        style={{
          width: "103%",
          marginLeft: "-1.5%",
          background: "linear-gradient(180deg,#4b5563 0%,#1f2937 100%)",
          boxShadow: "0 22px 34px -16px rgba(10,18,38,.42)",
        }}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-0 h-[4px] w-[86px] -translate-x-1/2 rounded-b-md"
          style={{ background: "rgba(0,0,0,.28)" }}
        />
      </div>
    </div>
  );
}
