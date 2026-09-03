import Link from "next/link";
import TableroPendientes from "./pendientes";
import { SECCION_LABEL } from "./vertical";
import { seccionActiva } from "./vertical-server";
import { datosDelTablero, type Metrica } from "./tablero/datos";
import {
  BarraDesglose,
  Chispa,
  ColumnasApiladas,
  ColumnasDiarias,
  mesCorto,
} from "./tablero/graficos";
import { IconChart, IconReserva, IconSobre, IconUsers } from "./iconos-admin";

/**
 * EL TABLERO DEL PANEL ADMIN.
 *
 * Antes esto era una grilla de quince tarjetas que solo decían adónde
 * ir. Ahora ir a algún lado es trabajo de la barra lateral, y esta
 * pantalla hace lo que una portada de panel tiene que hacer: contestar
 * "¿cómo viene la cosa?" sin que nadie tenga que entrar a seis
 * secciones a sumar de memoria.
 *
 * ── LO QUE NO SE MUESTRA ───────────────────────────────────────────
 * Nada que no salga de una fuente real. Cada número de acá tiene su
 * consulta en `tablero/datos.ts` y su comentario diciendo de qué tabla
 * sale. Si falta la llave de servicio, la pantalla lo dice en rojo en
 * vez de pintar ceros — un cero falso en un tablero hace tomar
 * decisiones equivocadas con toda confianza.
 */

const CRC = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});
const colones = (n: number) => CRC.format(n);
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES_LARGOS[(m ?? 1) - 1]} de ${y}`;
}

export default async function AdminHubPage() {
  const seccion = await seccionActiva();
  const d = await datosDelTablero(seccion);

  const mesEnCurso = d.libro[d.libro.length - 1];
  const mesPrevio = d.libro[d.libro.length - 2];
  const totalMes = mesEnCurso
    ? mesEnCurso.reservas + mesEnCurso.modulos + mesEnCurso.invitaciones
    : 0;
  const totalPrevio = mesPrevio
    ? mesPrevio.reservas + mesPrevio.modulos + mesPrevio.invitaciones
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-light tracking-[0.16em] text-aventurea-navy uppercase before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
          Panel Admin{seccion !== "todas" ? ` · ${SECCION_LABEL[seccion]}` : ""}
        </p>
        <h1 className="titulo mt-1 text-2xl text-aventurea-ink">{fechaLarga(d.hasta)}</h1>
        <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
          Los últimos 30 días, contados en hora de Costa Rica.
        </p>
      </div>

      {d.sinLlave && (
        <p
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3.5 text-[13px] font-bold leading-relaxed text-red-900"
        >
          Falta <code>SUPABASE_SERVICE_ROLE_KEY</code>. Sin esa llave, los pases, los cobros de
          módulos y los pedidos de invitación devuelven cero sin dar error — así que el tablero
          NO muestra números en vez de mostrarlos mal.
        </p>
      )}

      <TableroPendientes seccion={seccion} />

      {!d.sinLlave && (
        <>
          {/* ── Los cuatro números ───────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <TarjetaMetrica
              rotulo="Reservas creadas"
              metrica={d.reservas}
              icono={<IconReserva />}
              pie="Sin los bloqueos ni lo importado del calendario"
            />
            <TarjetaMetrica
              rotulo="Cuentas nuevas"
              metrica={d.clientes}
              icono={<IconUsers />}
              pie={
                seccion === "todas"
                  ? "De toda la plataforma"
                  : "De toda la plataforma — no se parte por sección"
              }
            />
            <TarjetaMetrica
              rotulo="Pases emitidos"
              metrica={d.pases}
              icono={<IconChart />}
              pie={`${d.pasesPorPlataforma.apple} Apple · ${d.pasesPorPlataforma.google} Google`}
            />
            <TarjetaMetrica
              rotulo="Pedidos de invitación"
              metrica={d.pedidos}
              icono={<IconSobre />}
              pie="Producto propio — no se parte por sección"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            {/* ── Lo que entra ──────────────────────────────────── */}
            <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[15px] font-bold text-aventurea-ink">Lo que entra</h2>
                  <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                    Comisión de reservas, paquetes de Lealtad e invitaciones.
                  </p>
                </div>
                <Link
                  href="/admin/finanzas"
                  className="shrink-0 text-[12.5px] font-bold text-aventurea-navy hover:text-aventurea-orange"
                >
                  Finanzas →
                </Link>
              </div>

              <p className="mt-4 text-[38px] leading-none font-extrabold text-aventurea-ink">
                {colones(totalMes)}
              </p>
              <p className="mt-1.5 text-[12.5px] text-aventurea-ink-soft">
                {mesEnCurso ? `En ${mesCorto(mesEnCurso.mes)}, hasta hoy.` : "Sin datos."}
                {totalPrevio > 0 && ` El mes pasado completo: ${colones(totalPrevio)}.`}
              </p>

              <div className="mt-5">
                <ColumnasApiladas
                  columnas={d.libro.map((m) => ({
                    etiqueta: mesCorto(m.mes),
                    partes: [
                      { nombre: "Reservas", valor: m.reservas, clase: "bg-aventurea-navy" },
                      { nombre: "Módulos", valor: m.modulos, clase: "bg-aventurea-sky" },
                      { nombre: "Invitaciones", valor: m.invitaciones, clase: "bg-aventurea-green" },
                    ],
                  }))}
                  formato={colones}
                />
              </div>

              {mesEnCurso && (
                <div className="mt-5 flex flex-col gap-3 border-t border-aventurea-line pt-4">
                  <BarraDesglose
                    nombre="Comisión de reservas"
                    valor={mesEnCurso.reservas}
                    total={totalMes}
                    clase="bg-aventurea-navy"
                    formato={colones}
                  />
                  <BarraDesglose
                    nombre="Paquetes y complementos"
                    valor={mesEnCurso.modulos}
                    total={totalMes}
                    clase="bg-aventurea-sky"
                    formato={colones}
                  />
                  <BarraDesglose
                    nombre="Invitaciones digitales"
                    valor={mesEnCurso.invitaciones}
                    total={totalMes}
                    clase="bg-aventurea-green"
                    formato={colones}
                  />
                </div>
              )}

              {d.dolaresDelMes > 0 && (
                <p className="mt-3.5 border-t border-aventurea-line pt-3 text-[12.5px] text-aventurea-ink-soft">
                  Además, en dólares: <strong>{USD.format(d.dolaresDelMes)}</strong>. Va aparte
                  porque no guardamos el tipo de cambio de cada cobro — sumarlo a los colones
                  sería inventar la cifra.
                </p>
              )}
            </section>

            {/* ── Estado de las fuentes ─────────────────────────── */}
            <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
              <h2 className="text-[15px] font-bold text-aventurea-ink">Estado de las fuentes</h2>
              <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                Lo que hace confiables a los números de arriba.
              </p>

              <ul className="mt-4 flex flex-col gap-2.5">
                <Chequeo
                  ok
                  texto="Llave de servicio presente — se leen todas las tablas."
                />
                <VigiaDelCron ultimo={d.ultimoDevengo} hoy={d.hasta} />
                <Chequeo
                  ok={d.seriesTruncadas.length === 0}
                  texto={
                    d.seriesTruncadas.length === 0
                      ? "Ninguna serie tocó el techo de 1000 filas."
                      : `La serie de ${d.seriesTruncadas.join(" y ")} tocó el techo de 1000 filas: los días más nuevos pueden estar cortados.`
                  }
                />
              </ul>

              <div className="mt-5 border-t border-aventurea-line pt-4">
                <p className="text-[11px] font-bold tracking-[0.12em] text-aventurea-ink-soft uppercase">
                  Publicaciones
                </p>
                <div className="mt-2 flex items-baseline gap-4">
                  <span className="text-[26px] leading-none font-extrabold text-aventurea-ink">
                    {d.publicaciones.publicadas}
                  </span>
                  <span className="text-[12.5px] text-aventurea-ink-soft">publicadas</span>
                  {d.publicaciones.pendientes > 0 && (
                    <Link
                      href="/admin/negocios"
                      className="ml-auto rounded-lg bg-aventurea-orange px-2.5 py-1 text-[11.5px] font-extrabold text-aventurea-ink"
                    >
                      {d.publicaciones.pendientes} por revisar
                    </Link>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* ── La serie diaria ──────────────────────────────────── */}
          <section className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[15px] font-bold text-aventurea-ink">
                  Reservas creadas, día por día
                </h2>
                <p className="mt-0.5 text-[12.5px] text-aventurea-ink-soft">
                  {d.reservas.total} en los últimos 30 días.
                </p>
              </div>
              <Link
                href="/admin/eventos"
                className="shrink-0 text-[12.5px] font-bold text-aventurea-navy hover:text-aventurea-orange"
              >
                Ver reservas →
              </Link>
            </div>
            <div className="mt-4">
              <ColumnasDiarias serie={d.reservas.serie} titulo="Reservas creadas por día" />
            </div>
          </section>

          <p className="text-[12px] leading-relaxed text-aventurea-ink-soft">
            Las publicaciones y las reservas se cuentan según la sección elegida en la barra;
            las invitaciones y las cuentas nuevas son de toda la plataforma y se cuentan
            siempre. Las reservas y los depósitos los aprueba cada proveedor desde su panel:
            no son pendientes de Bookea.
          </p>
        </>
      )}
    </div>
  );
}

function TarjetaMetrica({
  rotulo,
  metrica,
  icono,
  pie,
}: {
  rotulo: string;
  metrica: Metrica;
  icono: React.ReactNode;
  pie: string;
}) {
  const diferencia =
    metrica.semanaPrevia === null ? null : metrica.semana - metrica.semanaPrevia;

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-aventurea-line bg-aventurea-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aventurea-navy/10 text-aventurea-navy [&_svg]:h-[16px] [&_svg]:w-[16px]"
        >
          {icono}
        </span>
        {/* La comparación va en ABSOLUTO, no en porcentaje: "+4 que la
            semana pasada" se entiende; "+400%" sobre una base de 1 no
            dice nada y sobre una base de 0 no existe. */}
        {diferencia !== null && diferencia !== 0 && (
          <span
            className={`text-[11.5px] font-bold ${diferencia > 0 ? "text-aventurea-green" : "text-aventurea-ink-soft"}`}
          >
            {diferencia > 0 ? "+" : ""}
            {diferencia}
          </span>
        )}
      </div>
      <p className="mt-3 truncate text-[11.5px] font-bold tracking-wide text-aventurea-ink-soft uppercase">
        {rotulo}
      </p>
      <p className="mt-1 text-[28px] leading-none font-extrabold text-aventurea-ink tabular-nums">
        {metrica.semana}
      </p>
      <p className="mt-1 text-[11.5px] text-aventurea-ink-soft">
        esta semana · {metrica.total} en 30 días
      </p>
      <Chispa serie={metrica.serie} />
      <p className="mt-1.5 text-[11px] leading-snug text-aventurea-ink-muted">{pie}</p>
    </div>
  );
}

function Chequeo({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className={`mt-[3px] h-2 w-2 shrink-0 rounded-full ${ok ? "bg-aventurea-green" : "bg-aventurea-orange"}`}
      />
      <span className="text-[12.5px] leading-snug text-aventurea-ink-soft">{texto}</span>
    </li>
  );
}

/**
 * El vigía del cron de cobros.
 *
 * Sin esto, el cron de /api/cobro-plataforma caído se ve EXACTAMENTE
 * igual que un mes sin ventas: cero cobros, cero alarma. Tres días sin
 * un solo devengo es raro incluso en temporada baja.
 */
function VigiaDelCron({ ultimo, hoy }: { ultimo: string | null; hoy: string }) {
  if (!ultimo) {
    return (
      <Chequeo ok={false} texto="No hay ningún cobro devengado en los últimos 6 meses." />
    );
  }
  const dias = Math.round(
    (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${ultimo}T00:00:00Z`)) / 86_400_000,
  );
  if (dias <= 3) {
    return <Chequeo ok texto={`El cron de cobros corrió el ${ultimo}.`} />;
  }
  return (
    <Chequeo
      ok={false}
      texto={`El último cobro devengado es del ${ultimo}, hace ${dias} días. Puede que el cron de /api/cobro-plataforma no esté corriendo.`}
    />
  );
}
