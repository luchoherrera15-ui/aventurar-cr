import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { IconCamera, IconUsers } from "@/components/icons";

export const metadata: Metadata = {
  title: "Ejemplo: el panel de confirmaciones",
  description:
    "Así ves quién confirmó a tu evento: la tabla con cuántas personas trae cada invitación, el total al pie y el álbum con su código QR.",
};

/**
 * El ejemplo PÚBLICO del panel de confirmaciones.
 *
 * El panel de verdad vive en /cuenta/evento/[id] y es privado (pide
 * sesión y ser dueño del evento), así que desde la landing no se
 * puede enseñar: por eso esta copia con datos de mentira. Es estática
 * a propósito — cero consultas, cero sesión, se puede compartir.
 *
 * Espeja la tabla de `cuenta/evento/[id]/tabla-rsvps.tsx` (misma
 * cabecera, misma numeración, mismo total al pie) pero sin estado:
 * acá no hay filtros ni borrar, porque no hay nada real que filtrar.
 * Si la tabla real cambia de forma, esta queda desactualizada: es el
 * costo de poder mostrarla sin cuenta. Está marcada como ejemplo en
 * pantalla para que nadie la confunda con su evento.
 */

type Fila = {
  nombre: string;
  acompanantes: number;
  asistira: boolean;
  detalle: string | null;
};

const FILAS: Fila[] = [
  { nombre: "Jose Pablo Herrera", acompanantes: 2, asistira: true, detalle: "Pollo · Sin alergias" },
  { nombre: "Daniela Chaves", acompanantes: 1, asistira: true, detalle: "Vegetariano" },
  { nombre: "Marcela Vindas", acompanantes: 0, asistira: true, detalle: "Pollo" },
  { nombre: "Carlos Jiménez", acompanantes: 3, asistira: true, detalle: "Pollo · Mesa de niños" },
  { nombre: "Andrés Mora", acompanantes: 0, asistira: false, detalle: "Ese finde estoy fuera del país." },
  { nombre: "Sofía Alfaro", acompanantes: 1, asistira: true, detalle: "Vegetariano" },
];

const personasDe = (f: Fila) => (f.asistira ? 1 + f.acompanantes : 0);

const ASISTIRAN = FILAS.filter((f) => f.asistira);
const NO_VAN = FILAS.filter((f) => !f.asistira);
const TOTAL = ASISTIRAN.reduce((s, f) => s + personasDe(f), 0);

export default function EjemploConfirmacionesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-aventurea-cream-2">
      <SiteHeader breadcrumb="Ejemplo" />

      <main className="mx-auto w-full max-w-[860px] flex-1 px-5 py-8">
        <Link
          href="/invitaciones#ejemplos"
          className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Volver a los ejemplos
        </Link>

        <div className="mt-3 rounded-2xl border border-aventurea-sky/40 bg-aventurea-sky/10 px-5 py-3.5">
          <p className="text-[13px] leading-relaxed text-aventurea-ink">
            <strong>Esto es un ejemplo</strong> con invitados inventados, para que veas
            cómo se ve tu panel. Con tu invitación, esta tabla se llena sola cada vez
            que alguien confirma.
          </p>
        </div>

        {/* La ficha del evento */}
        <section className="mt-4 rounded-2xl border border-aventurea-line bg-white p-6">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
            Tu espacio de fiesta
          </p>
          <h1 className="titulo mt-2 text-[26px] text-aventurea-ink sm:text-[30px]">
            Boda de María Jesús &amp; Luis
          </h1>
          <p className="mt-1.5 text-[13px] text-aventurea-ink-soft">
            Sábado 1 de agosto de 2026 · 1:00 p. m. · Hacienda Los Reyes
          </p>
        </section>

        {/* Confirmaciones */}
        <section className="mt-4 rounded-2xl border border-aventurea-line bg-white p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-aventurea-ink">
            <IconUsers className="h-4.5 w-4.5 text-aventurea-orange" /> Confirmaciones
          </h2>

          {/* Los mismos chips de resumen del panel real */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="flex items-center gap-2 rounded-xl border border-aventurea-navy bg-aventurea-navy px-3.5 py-2 text-[12.5px] font-bold text-white">
              <span className="text-[15px] font-extrabold tabular-nums">{FILAS.length}</span>
              Invitaciones
            </span>
            <span className="flex items-center gap-2 rounded-xl border border-aventurea-line bg-white px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft">
              <span className="text-[15px] font-extrabold tabular-nums text-aventurea-green">
                {ASISTIRAN.length}
              </span>
              Asistirán
            </span>
            <span className="flex items-center gap-2 rounded-xl border border-aventurea-line bg-white px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink-soft">
              <span className="text-[15px] font-extrabold tabular-nums text-red-600">
                {NO_VAN.length}
              </span>
              No asistirán
            </span>
            <span className="flex items-center gap-2 rounded-xl border border-aventurea-sky/40 bg-aventurea-sky/10 px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink">
              <span className="text-[15px] font-extrabold tabular-nums text-aventurea-sky-dark">
                {TOTAL}
              </span>
              Personas
            </span>
          </div>

          {/* La tabla de control, con el total al pie */}
          <div className="mt-3 overflow-x-auto rounded-xl border border-aventurea-line">
            {/* Mismo apretado que el panel real en el teléfono: sin "#"
                y con la insignia en ✓/✕, para que el total quepa. */}
            <table className="w-full min-w-[300px] border-collapse text-left sm:min-w-[520px]">
              <thead>
                <tr className="bg-aventurea-cream-2 text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  <th className="hidden w-10 px-3 py-2.5 text-center sm:table-cell">#</th>
                  <th className="px-2.5 py-2.5 sm:px-3">Nombre</th>
                  <th className="px-2.5 py-2.5 sm:px-3">
                    <span className="hidden sm:inline">Asistencia</span>
                    <span className="sm:hidden">Va</span>
                  </th>
                  <th className="px-2.5 py-2.5 text-right sm:px-3">
                    <span className="hidden sm:inline">Personas</span>
                    <span className="sm:hidden">Pers.</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {FILAS.map((f, i) => (
                  <tr key={f.nombre} className="border-t border-aventurea-line align-top">
                    <td className="hidden px-3 py-2.5 text-center text-[12px] font-bold tabular-nums text-aventurea-ink-soft sm:table-cell">
                      {i + 1}
                    </td>
                    <td className="px-2.5 py-2.5 sm:px-3">
                      <p className="text-[13.5px] font-bold text-aventurea-ink">{f.nombre}</p>
                      {f.detalle && (
                        <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                          {f.detalle}
                        </p>
                      )}
                    </td>
                    <td className="px-2.5 py-2.5 sm:px-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-lg px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide sm:px-2.5 ${
                          f.asistira
                            ? "bg-aventurea-green-light text-aventurea-green"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        <span className="hidden sm:inline">
                          {f.asistira ? "✓ Asistirá" : "✕ No asistirá"}
                        </span>
                        <span className="sm:hidden">{f.asistira ? "✓ Sí" : "✕ No"}</span>
                      </span>
                    </td>
                    <td className="px-2.5 py-2.5 text-right text-[13.5px] font-bold tabular-nums text-aventurea-ink sm:px-3">
                      {f.asistira ? personasDe(f) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-aventurea-navy/20 bg-aventurea-cream-2">
                  <td className="hidden sm:table-cell" />
                  <td
                    colSpan={2}
                    className="px-2.5 py-3 text-[12.5px] font-bold text-aventurea-ink sm:px-3 sm:text-[13px]"
                  >
                    Total de invitados que asistirán
                  </td>
                  <td className="px-2.5 py-3 text-right text-[17px] font-extrabold tabular-nums text-aventurea-ink sm:px-3">
                    {TOTAL}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-2 text-[12px] leading-relaxed text-aventurea-ink-soft">
            El total cuenta a cada confirmado con sus acompañantes — es el número que le
            podés dar al catering y al lugar. En tu panel podés buscar por nombre,
            filtrar y sacarlo en PDF con un botón.
          </p>
        </section>

        {/* El álbum */}
        <section className="mt-4 rounded-2xl border border-aventurea-line bg-white p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-aventurea-ink">
            <IconCamera className="h-4.5 w-4.5 text-aventurea-orange" /> El álbum del evento
          </h2>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
            Imprimís un código QR y lo ponés en las mesas: tus invitados escanean, ven las
            fotos del evento y suben las suyas sin instalar nada.
          </p>
          <Link
            href="/a/fotos-ejemplo-cumpleanos-star-wars-de-luis-herrera"
            className="mt-4 inline-flex rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
          >
            Ver un álbum de ejemplo →
          </Link>
        </section>

        <div className="mt-8 text-center">
          <Link href="/invitaciones#paquetes" className="btn-naranja">
            Quiero la mía
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
