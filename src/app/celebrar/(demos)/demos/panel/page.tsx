import type { Metadata } from "next";
import BarraDemo from "@/components/celebrar/barra-demo";
import MarcaCelebrar from "@/components/celebrar/marca-celebrar";
import BalanceCreditos from "@/components/celebrar/panel/balance-creditos";
import MenuApp from "@/components/celebrar/panel/menu-app";
import { EncabezadoPanel, TarjetaPanel } from "@/components/celebrar/panel/piezas";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import type { MovimientoCreditos } from "@/lib/celebrar/datos";
import { RUTA } from "@/lib/celebrar/rutas";

export const metadata: Metadata = { title: "Demo · El panel del anfitrión" };

/**
 * EL PANEL, DE MUESTRA: lo que ve quien organiza —sus confirmaciones en
 * vivo con las preguntas que configuró, el balance de créditos, el link
 * de la invitación— con datos ficticios de la quince de Camila. Mismo
 * shell y mismas piezas que el panel real; nada se puede editar.
 */

type Confirmacion = { nombre: string; asiste: boolean; personas: number; menu: string; alergias: string; mensaje: string; cuando: string };

const CONFIRMACIONES: Confirmacion[] = [
  { nombre: "Familia Fernández Mora", asiste: true, personas: 4, menu: "Carne", alergias: "", mensaje: "¡Ahí estaremos, princesa!", cuando: "Hoy, 9:14 a. m." },
  { nombre: "Andrea Montero", asiste: true, personas: 2, menu: "Vegetariano", alergias: "Sin maní", mensaje: "No me lo pierdo por nada.", cuando: "Hoy, 8:02 a. m." },
  { nombre: "Tía Rosa y tío Jorge", asiste: true, personas: 2, menu: "Pollo", alergias: "", mensaje: "", cuando: "Ayer, 7:45 p. m." },
  { nombre: "Sofía Ramírez", asiste: true, personas: 1, menu: "Carne", alergias: "Intolerante a la lactosa", mensaje: "¡Felicidades Cami!", cuando: "Ayer, 6:10 p. m." },
  { nombre: "Los primos Solano", asiste: true, personas: 5, menu: "Carne", alergias: "", mensaje: "Llevamos el ánimo.", cuando: "Ayer, 3:30 p. m." },
  { nombre: "Daniela Rojas", asiste: false, personas: 0, menu: "", alergias: "", mensaje: "Estoy fuera del país, los quiero.", cuando: "Ayer, 11:20 a. m." },
  { nombre: "Abuela Marta", asiste: true, personas: 1, menu: "Pollo", alergias: "Bajo en sal", mensaje: "Mi niña hermosa.", cuando: "Lunes, 5:05 p. m." },
  { nombre: "Familia Castro", asiste: true, personas: 3, menu: "Carne", alergias: "", mensaje: "", cuando: "Lunes, 2:48 p. m." },
  { nombre: "Pablo Jiménez (DJ)", asiste: true, personas: 1, menu: "Vegetariano", alergias: "", mensaje: "Llego a las 6 para probar sonido.", cuando: "Domingo, 8:31 p. m." },
  { nombre: "Valeria Quesada", asiste: false, personas: 0, menu: "", alergias: "", mensaje: "Tengo examen el lunes, ¡perdón!", cuando: "Domingo, 10:12 a. m." },
];

const MOVIMIENTOS: MovimientoCreditos[] = [
  { id: "m1", celebracion_id: "demo", tipo: "consumo", cantidad: -120, concepto: "Publicar la invitación (confirmación en la página)", referencia: null, monto_crc: null, created_at: "2026-09-18T15:10:00Z" },
  { id: "m2", celebracion_id: "demo", tipo: "consumo", cantidad: -8, concepto: "Invitación con IA · Musa", referencia: null, monto_crc: null, created_at: "2026-09-18T14:40:00Z" },
  { id: "m3", celebracion_id: null, tipo: "compra", cantidad: 250, concepto: "Paquete de 250 créditos (tarjeta)", referencia: "cs_demo", monto_crc: 11500, created_at: "2026-09-18T14:30:00Z" },
];

export default function DemoPanelPage() {
  const confirmaron = CONFIRMACIONES.filter((c) => c.asiste);
  const personas = confirmaron.reduce((s, c) => s + c.personas, 0);
  const noPueden = CONFIRMACIONES.length - confirmaron.length;
  const saldo = MOVIMIENTOS.reduce((s, m) => s + m.cantidad, 0);

  return (
    <div className="celebrar flex min-h-screen flex-col bg-(--c-hielo) pb-24 lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:pb-0">
      <aside className="sobre-oscuro hidden bg-(--c-marino) text-(--c-blanco) lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-4 lg:py-6">
        <div className="px-2">
          <MarcaCelebrar tono="claro" />
        </div>
        <div className="mt-9 flex-1 opacity-90">
          <MenuApp variante="rail" />
        </div>
        <div className="border-t border-(--c-marino-medio) pt-5">
          <div className="flex items-center gap-3 px-2">
            <span className="c-montserrat flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--c-blanco) text-[13px] font-bold text-(--c-marino)" aria-hidden="true">
              CF
            </span>
            <div className="min-w-0">
              <p className="c-montserrat truncate text-[13px] font-semibold text-(--c-blanco)">Familia Fernández</p>
              <p className="truncate text-[12px] text-(--c-sobre-marino-suave)">cuenta de muestra</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-(--c-linea) bg-(--c-blanco)">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <span className="lg:hidden">
                <MarcaCelebrar tamano="sm" />
              </span>
              <span className="c-montserrat rounded-full bg-(--c-celeste) px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-(--c-marino)">Demo del panel</span>
              <p className="hidden text-[13px] text-(--c-tinta-suave) sm:block">Así ve el anfitrión sus confirmaciones. Datos de muestra.</p>
            </div>
            <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-primario min-h-9 text-[13px]">
              Crear mi cuenta
            </EnlaceCelebrar>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="grid gap-8">
            <EncabezadoPanel titulo="Invitados" descripcion="Lo que responde la gente en tu invitación, en vivo. Elegí la celebración y mirá quién viene." />

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Celebración">
              <span className="c-montserrat rounded-xl bg-(--c-marino) px-4 py-2 text-[13px] font-semibold text-(--c-blanco)">Camila Fernanda · XV años</span>
              <span className="c-montserrat rounded-xl border border-(--c-linea) bg-(--c-blanco) px-4 py-2 text-[13px] font-semibold text-(--c-tinta-suave)">Los 7 de Mateo</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <TarjetaPanel tono="marina">
                <p className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.1em] text-(--c-sobre-marino-suave)">Confirmaron</p>
                <p className="c-montserrat mt-2 text-4xl font-extrabold leading-none text-(--c-blanco)">{confirmaron.length}</p>
                <p className="mt-2 text-[12px] text-(--c-sobre-marino-suave)">{personas} personas en total</p>
              </TarjetaPanel>
              <TarjetaPanel>
                <p className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">No pueden ir</p>
                <p className="c-montserrat mt-2 text-4xl font-extrabold leading-none text-(--c-tinta)">{noPueden}</p>
                <p className="mt-2 text-[12px] text-(--c-tinta-suave)">avisaron que no llegan</p>
              </TarjetaPanel>
              <TarjetaPanel>
                <p className="c-montserrat text-[11px] font-semibold uppercase tracking-[0.1em] text-(--c-tinta-suave)">La invitación</p>
                <p className="c-montserrat mt-2 text-lg font-extrabold leading-tight text-(--c-ok)">Publicada · confirman en la página</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="c-boton c-boton-secundario min-h-9 text-[12px]">Copiar link</span>
                  <EnlaceCelebrar a="/demos/xv" className="c-boton c-boton-secundario min-h-9 text-[12px]">
                    Ver la invitación
                  </EnlaceCelebrar>
                </div>
              </TarjetaPanel>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr] xl:items-start">
              <TarjetaPanel className="overflow-hidden !p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--c-linea) px-6 py-4">
                  <div>
                    <h2 className="text-xl leading-tight text-(--c-tinta)">Confirmaciones</h2>
                    <p className="mt-0.5 text-[13px] text-(--c-tinta-suave)">{CONFIRMACIONES.length} respuestas, la más reciente primero. Las columnas «Menú» y «Alergias» son las preguntas que configuró la anfitriona.</p>
                  </div>
                  <span className="c-boton c-boton-secundario min-h-9 text-[12px] opacity-70" title="En el panel real descarga el Excel">
                    Descargar CSV
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-(--c-hielo) text-left text-[11px] uppercase tracking-[0.08em] text-(--c-tinta-suave)">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Nombre</th>
                        <th className="px-4 py-2 font-semibold">Asiste</th>
                        <th className="px-4 py-2 font-semibold">Personas</th>
                        <th className="px-4 py-2 font-semibold">Menú</th>
                        <th className="px-4 py-2 font-semibold">Alergias</th>
                        <th className="px-4 py-2 font-semibold">Mensaje</th>
                        <th className="px-4 py-2 font-semibold">Cuándo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-(--c-linea)">
                      {CONFIRMACIONES.map((c) => (
                        <tr key={c.nombre}>
                          <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-(--c-tinta)">{c.nombre}</td>
                          <td className="px-4 py-2.5">
                            <span className={`c-montserrat rounded-full px-2 py-0.5 text-[11px] font-bold ${c.asiste ? "bg-(--c-ok-suave) text-(--c-ok)" : "bg-(--c-coral-suave) text-(--c-coral-tinta)"}`}>{c.asiste ? "Sí" : "No"}</span>
                          </td>
                          <td className="px-4 py-2.5 text-(--c-tinta)">{c.asiste ? c.personas : "—"}</td>
                          <td className="px-4 py-2.5 text-(--c-tinta)">{c.menu || "—"}</td>
                          <td className="px-4 py-2.5 text-(--c-tinta)">{c.alergias || "—"}</td>
                          <td className="max-w-[240px] px-4 py-2.5 text-(--c-tinta-suave)">{c.mensaje || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-(--c-tinta-suave)">{c.cuando}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TarjetaPanel>

              <div className="grid gap-6">
                <BalanceCreditos movimientos={MOVIMIENTOS} saldo={saldo} compacto />
                <TarjetaPanel>
                  <h2 className="text-lg leading-tight text-(--c-tinta)">Y después de la fiesta</h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-(--c-tinta-suave)">
                    Desde este mismo panel se administran el álbum de fotos que suben los invitados y la página de recuerdos.{" "}
                    <EnlaceCelebrar a={RUTA.demoAlbum} className="font-semibold text-(--c-azul) underline underline-offset-4">
                      Ver el demo del álbum
                    </EnlaceCelebrar>
                  </p>
                </TarjetaPanel>
              </div>
            </div>
          </div>
        </main>
      </div>

      <BarraDemo texto="Demo · el panel del anfitrión" cta="Crear mi cuenta" />
    </div>
  );
}
