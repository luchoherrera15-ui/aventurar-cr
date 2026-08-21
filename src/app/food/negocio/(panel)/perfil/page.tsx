import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { miNegocioFood } from "@/lib/food/auth";
import { horaCorta } from "@/lib/food/tipos";
import { EncabezadoPagina, TarjetaPanel } from "@/components/food/panel";
import {
  BOTON_PANEL,
  BOTON_PANEL_PRIMARIO,
  ENLACE_CARD,
  ESTADO_MARCA,
  ESTADO_PILDORA,
  RADIO_TILE,
  SUPERFICIE_HUNDIDA,
  SUPERFICIE_PANEL,
} from "@/components/panel/sistema";
import { IconCheck, IconPin } from "@/components/icons";

/**
 * PERFIL — cómo se ve el restaurante en Food Bookea, contado con los
 * datos REALES de la base (food_businesses + food_locations +
 * food_hours + el menú). Nada de utilería acá: si un dato falta, la
 * pantalla lo dice y empuja a completarlo — por eso no hay ninguna
 * <NotaDemo /> en este archivo.
 *
 * Es una pantalla de LECTURA a propósito: el perfil se mira acá y se
 * edita en Configuración (el botón "Editar perfil" lleva allá). Tener
 * una vista de solo-lectura separada del formulario es lo que permite
 * que el dueño se vea "como lo ve un cliente" sin el ruido de los
 * campos de edición.
 *
 * Los campos que el producto quiere y el esquema todavía no tiene
 * (categoría gastronómica, WhatsApp/Instagram, rango de precios,
 * características) NO se pintan como formularios muertos ni con datos
 * inventados: van en la tarjeta "Muy pronto", el mismo patrón
 * "Próximamente" del selector de restaurante del rail. Cuando exista
 * la migración que los agregue, se mueven de esa lista a la vista.
 */

/** dia_semana de food_hours: 0=domingo … 6=sábado (getUTCDay). */
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Se lee lunes→domingo, que es como la gente piensa la semana. */
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

type FilaHora = { location_id: string; dia_semana: number; abre: string; cierra: string };

/**
 * Las líneas de horario de una sede, listas para pintar: un renglón
 * por día con sus rangos ("11:00 a.m. – 3:00 p.m. y 6:00 p.m. –
 * 10:00 p.m."). Los días sin filas no aparecen — un restaurante que
 * cierra lunes simplemente no lista el lunes.
 */
function lineasDeHorario(filas: FilaHora[]): { dia: string; rangos: string }[] {
  const lineas: { dia: string; rangos: string }[] = [];
  for (const d of ORDEN_DIAS) {
    const delDia = filas
      .filter((f) => f.dia_semana === d)
      .sort((a, b) => a.abre.localeCompare(b.abre));
    if (delDia.length === 0) continue;
    lineas.push({
      dia: DIAS[d],
      rangos: delDia.map((f) => `${horaCorta(f.abre)} – ${horaCorta(f.cierra)}`).join(" y "),
    });
  }
  return lineas;
}

export default async function PerfilFoodPage() {
  const negocioBase = await miNegocioFood();
  if (!negocioBase) redirect("/food/negocio/nuevo");

  const supabase = await createClient();
  const [{ data: negocio }, { data: sedes }, { data: platos }] = await Promise.all([
    supabase
      .from("food_businesses")
      .select("id, nombre, slug, descripcion, foto_portada_url, telefono, activo")
      .eq("id", negocioBase.id)
      .single(),
    supabase
      .from("food_locations")
      .select("id, nombre, direccion, telefono")
      .eq("business_id", negocioBase.id)
      .order("nombre"),
    supabase.from("food_menu_items").select("id, activo").eq("business_id", negocioBase.id),
  ]);

  if (!negocio) redirect("/food/negocio/nuevo");

  // El horario se pide aparte porque depende de las sedes; con cero
  // sedes ni siquiera hay que ir a la base.
  const listaSedes = sedes ?? [];
  let horas: FilaHora[] = [];
  if (listaSedes.length > 0) {
    const { data, error } = await supabase
      .from("food_hours")
      .select("location_id, dia_semana, abre, cierra")
      .in(
        "location_id",
        listaSedes.map((s) => s.id),
      );
    if (error) console.error("[food/negocio perfil] horario:", error.message);
    horas = data ?? [];
  }

  const horasPorSede = new Map<string, FilaHora[]>();
  for (const h of horas) {
    const lista = horasPorSede.get(h.location_id) ?? [];
    lista.push(h);
    horasPorSede.set(h.location_id, lista);
  }

  const listaPlatos = platos ?? [];
  const platosActivos = listaPlatos.filter((p) => p.activo).length;
  const urlPublica = `/food/restaurante/${negocio.slug}`;

  // La "salud del perfil": qué le falta a la ficha para verse completa
  // ante un cliente. Todo derivado de la base — nada de porcentajes
  // decorativos sin tabla detrás.
  const chequeos: { id: string; etiqueta: string; ok: boolean }[] = [
    { id: "portada", etiqueta: "Foto de portada", ok: Boolean(negocio.foto_portada_url) },
    { id: "descripcion", etiqueta: "Descripción del restaurante", ok: Boolean(negocio.descripcion) },
    {
      id: "telefono",
      etiqueta: "Teléfono de contacto",
      ok: Boolean(negocio.telefono) || listaSedes.some((s) => s.telefono),
    },
    {
      id: "direccion",
      etiqueta: "Dirección de al menos una sede",
      ok: listaSedes.some((s) => s.direccion),
    },
    { id: "horario", etiqueta: "Horario de atención", ok: horas.length > 0 },
    { id: "menu", etiqueta: "Menú con platos visibles", ok: platosActivos > 0 },
  ];
  const completos = chequeos.filter((c) => c.ok).length;
  const porcentaje = Math.round((completos / chequeos.length) * 100);

  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina
        titulo="Perfil"
        descripcion="Así se presenta tu restaurante ante un cliente en Food Bookea."
        acciones={
          <>
            <Link href={urlPublica} className={BOTON_PANEL}>
              Ver página pública
            </Link>
            <Link href="/food/negocio/configuracion" className={BOTON_PANEL_PRIMARIO}>
              Editar perfil
            </Link>
          </>
        }
      />

      {/* ── La ficha, como la vería un cliente ─────────────────────── */}
      <section className={`${SUPERFICIE_PANEL} overflow-hidden rounded-3xl`}>
        <div className="relative h-40 bg-aventurea-navy sm:h-56">
          {negocio.foto_portada_url ? (
            <>
              <Image
                src={negocio.foto_portada_url}
                alt={`Portada de ${negocio.nombre}`}
                fill
                sizes="(max-width: 1180px) 100vw, 1148px"
                className="object-cover"
                priority
              />
              {/* Degradé decorativo para que la foto no "corte" en seco
                  contra la franja blanca de abajo. */}
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent"
                aria-hidden
              />
            </>
          ) : (
            <div className="grid h-full place-items-center px-6">
              <p className="max-w-[40ch] text-center text-[13px] leading-relaxed text-aventurea-rail">
                Todavía no subiste una foto de portada — es lo primero que ve un cliente. Se sube
                en Configuración.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
          {/* El "logo": inicial sobre el naranja de FOOD, igual que el
              selector del rail — no existe columna de logo todavía. */}
          <span
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-aventurea-orange text-[22px] font-extrabold text-white"
            aria-hidden
          >
            {negocio.nombre.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="titulo text-[22px] leading-tight tracking-tight text-aventurea-navy">
              {negocio.nombre}
            </h2>
            <Link
              href={urlPublica}
              className="mt-0.5 block truncate text-[12.5px] font-bold text-aventurea-sky-dark hover:underline"
            >
              bookea.lat{urlPublica}
            </Link>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${
              negocio.activo ? ESTADO_PILDORA.exito : ESTADO_PILDORA.alerta
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                negocio.activo ? ESTADO_MARCA.exito : ESTADO_MARCA.alerta
              }`}
              aria-hidden
            />
            {negocio.activo ? "Publicado" : "Apagado"}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        {/* ── Columna ancha: la identidad y las sedes ──────────────── */}
        <div className="flex flex-col gap-3.5">
          <TarjetaPanel
            kicker="Identidad"
            titulo="Acerca de tu restaurante"
            accion={
              <Link href="/food/negocio/configuracion" className={ENLACE_CARD}>
                Editar →
              </Link>
            }
          >
            {negocio.descripcion ? (
              <p className="max-w-[62ch] text-[13.5px] leading-relaxed text-aventurea-ink">
                {negocio.descripcion}
              </p>
            ) : (
              <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
                Sin descripción todavía. Dos o tres líneas sobre tu cocina ayudan a que un cliente
                se decida — se escriben en Configuración.
              </p>
            )}
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-3`}>
                <dt className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Teléfono
                </dt>
                <dd
                  className={`mt-1 text-[13.5px] font-bold ${
                    negocio.telefono ? "text-aventurea-ink" : "text-aventurea-ink-soft"
                  }`}
                >
                  {negocio.telefono ?? "Sin teléfono"}
                </dd>
              </div>
              <div className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-3`}>
                <dt className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
                  Platos en tu vitrina
                </dt>
                <dd className="mt-1 text-[13.5px] font-bold text-aventurea-ink">
                  {platosActivos} {platosActivos === 1 ? "visible" : "visibles"} al público
                  {listaPlatos.length > platosActivos &&
                    ` · ${listaPlatos.length - platosActivos} apagado${
                      listaPlatos.length - platosActivos === 1 ? "" : "s"
                    }`}
                </dd>
              </div>
            </dl>
          </TarjetaPanel>

          <TarjetaPanel kicker="Ubicación" titulo={listaSedes.length === 1 ? "Tu sede" : "Sedes y horarios"}>
            {listaSedes.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-aventurea-ink-soft">
                Sin sedes registradas todavía.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {listaSedes.map((sede) => {
                  const lineas = lineasDeHorario(horasPorSede.get(sede.id) ?? []);
                  return (
                    <div key={sede.id} className={`${SUPERFICIE_HUNDIDA} ${RADIO_TILE} p-4`}>
                      <p className="text-[14px] font-bold text-aventurea-ink">{sede.nombre}</p>
                      {sede.direccion ? (
                        <p className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
                          <IconPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          {sede.direccion}
                        </p>
                      ) : (
                        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
                          Sin dirección — agregala en Configuración para que te encuentren.
                        </p>
                      )}
                      {sede.telefono && (
                        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
                          Tel. {sede.telefono}
                        </p>
                      )}

                      {lineas.length === 0 ? (
                        <p className="mt-3 border-t border-aventurea-line pt-3 text-[12px] text-aventurea-ink-soft">
                          Sin horario cargado todavía.
                        </p>
                      ) : (
                        <ul className="mt-3 flex flex-col gap-1 border-t border-aventurea-line pt-3">
                          {lineas.map((l) => (
                            <li
                              key={l.dia}
                              className="flex items-baseline justify-between gap-3 text-[12.5px]"
                            >
                              <span className="font-bold text-aventurea-ink">{l.dia}</span>
                              <span className="text-right tabular-nums text-aventurea-ink-soft">
                                {l.rangos}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TarjetaPanel>
        </div>

        {/* ── Columna angosta: qué falta y qué viene ───────────────── */}
        <div className="flex flex-col gap-3.5">
          <TarjetaPanel kicker="Puesta a punto" titulo="Salud del perfil">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-aventurea-ink">
                {porcentaje}%
              </p>
              <p className="text-[11.5px] font-bold text-aventurea-ink-soft">
                {completos} de {chequeos.length} completos
              </p>
            </div>
            <div
              className="mt-2.5 h-2 overflow-hidden rounded-full bg-aventurea-cream-2"
              role="img"
              aria-label={`Perfil completo al ${porcentaje}%`}
            >
              <div
                className="h-full rounded-full bg-aventurea-green"
                style={{ width: `${porcentaje}%` }}
              />
            </div>

            <ul className="mt-4 flex flex-col gap-2.5">
              {chequeos.map((c) => (
                <li key={c.id} className="flex items-center gap-2.5">
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                      c.ok
                        ? "bg-aventurea-green-light text-aventurea-green"
                        : "bg-aventurea-cream-2"
                    }`}
                    aria-hidden
                  >
                    {c.ok ? (
                      <IconCheck className="h-3 w-3" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-aventurea-line-fuerte" />
                    )}
                  </span>
                  <span
                    className={`text-[13px] ${
                      c.ok ? "text-aventurea-ink" : "text-aventurea-ink-soft"
                    }`}
                  >
                    {c.etiqueta}
                    {/* El estado también en texto, no solo en el ícono. */}
                    {!c.ok && <span className="font-bold"> — pendiente</span>}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/food/negocio/configuracion" className={BOTON_PANEL}>
                Ir a Configuración
              </Link>
              <Link href="/food/negocio/menu" className={BOTON_PANEL}>
                Ir al menú
              </Link>
            </div>
          </TarjetaPanel>

          <TarjetaPanel kicker="En camino" titulo="Muy pronto">
            <p className="text-[12.5px] leading-relaxed text-aventurea-ink-soft">
              Estos datos del perfil vienen en las próximas semanas:
            </p>
            <ul className="mt-2.5 flex flex-col gap-1.5 text-[13px] text-aventurea-ink">
              <li>· Categoría gastronómica</li>
              <li>· WhatsApp e Instagram</li>
              <li>· Rango de precios</li>
              <li>· Características (terraza, parqueo, apto para niños…)</li>
            </ul>
          </TarjetaPanel>
        </div>
      </div>
    </div>
  );
}
