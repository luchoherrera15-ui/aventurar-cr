"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  leerProveedorActual,
  leerProveedorActualServidor,
  suscribirProveedorActual,
} from "@/lib/proveedor-actual";
import {
  alternarChatPanel,
  cerrarChatPanel,
  fijarSinLeerChatPanel,
  leerChatPanel,
  leerChatPanelServidor,
  suscribirChatPanel,
} from "@/lib/chat-panel";
import {
  categorizarConversacion,
  CATEGORIA_CHAT_LABEL,
  ORDEN_CATEGORIAS_CHAT,
  type CategoriaChat,
} from "@/lib/chat-categorias";
import HiloChat from "@/app/mensajes/[reservaId]/hilo-chat";
import type { Mensaje } from "@/app/mi-negocio/types";
import { IconChatBubble, IconChevronDown } from "./icons";
import PreviewMensaje from "./preview-mensaje";

/**
 * El chat del sitio como ventana flotante (tipo soporte en vivo): la
 * burbuja de siempre abre un panel adentro de la página — nada de
 * saltar a otra pestaña ni perder dónde estabas. El panel tiene dos
 * vistas: la lista de conversaciones (por pestañas de categoría) y el
 * hilo abierto (que reutiliza el mismo HiloChat de /mensajes, con su
 * Realtime y su respaldo).
 *
 * Se abre desde dos lugares: el ícono del header (`menu-cuenta.tsx`,
 * en todo el sitio, con sesión) y la burbuja propia de esta página,
 * que solo se muestra en la página de un proveedor (donde
 * `<ProveedorActual>` registra "este es el negocio actual") — ahí
 * sigue siendo el único punto de entrada para alguien SIN cuenta que
 * quiere preguntarle algo a ese negocio puntual (sesión anónima). Los
 * dos triggers comparten el mismo estado abierto/cerrado a través de
 * `src/lib/chat-panel.ts`, porque no comparten árbol de React.
 *
 * El contador se refresca por Realtime (los INSERT llegan filtrados
 * por RLS: solo tus conversaciones), al volver a la pestaña y con un
 * respaldo cada minuto.
 */

type FilaWidget = {
  id: string;
  titulo: string;
  subtitulo: string;
  foto: string | null;
  ultimoTexto: string;
  actividad: string;
  pendientes: number;
  categoria: CategoriaChat;
};

type HiloAbierto = {
  conversacionId: string;
  titulo: string;
  miId: string;
  mensajes: Mensaje[];
};

export default function ChatFlotante() {
  const pathname = usePathname();
  const { abierto, sinLeer } = useSyncExternalStore(
    suscribirChatPanel,
    leerChatPanel,
    leerChatPanelServidor,
  );
  const [cargandoPanel, setCargandoPanel] = useState(false);
  const [sinSesion, setSinSesion] = useState(false);
  const [filas, setFilas] = useState<FilaWidget[]>([]);
  const [hilo, setHilo] = useState<HiloAbierto | null>(null);
  const [tabActiva, setTabActiva] = useState<CategoriaChat | null>(null);
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const proveedor = useSyncExternalStore(
    suscribirProveedorActual,
    leerProveedorActual,
    leerProveedorActualServidor,
  );

  const cargar = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: convData } = await supabase.from("conversaciones").select("id, resuelta");
    const conversaciones = (convData ?? []) as { id: string; resuelta: boolean }[];
    if (conversaciones.length === 0) return;
    // El contador cuenta SOLO los hilos activos: los archivados no
    // aparecen en el panel, así que un pendiente ahí sería un número
    // imposible de bajar. Si llega un mensaje nuevo, el hilo se reabre
    // solo (trigger de 0054) y vuelve a contar.
    const ids = conversaciones.filter((c) => !c.resuelta).map((c) => c.id);
    if (ids.length === 0) {
      fijarSinLeerChatPanel(0);
      return;
    }

    const [{ data: mensajesData }, { data: lecturasData }] = await Promise.all([
      supabase
        .from("mensajes")
        .select("conversacion_id, autor_id, created_at")
        .in("conversacion_id", ids)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("conversacion_lecturas")
        .select("conversacion_id, leido_hasta")
        .eq("usuario_id", user.id),
    ]);

    const leidoHasta = new Map<string, string>(
      ((lecturasData ?? []) as { conversacion_id: string; leido_hasta: string }[]).map(
        (l) => [l.conversacion_id, l.leido_hasta],
      ),
    );

    let pendientes = 0;
    for (const m of (mensajesData ?? []) as {
      conversacion_id: string;
      autor_id: string;
      created_at: string;
    }[]) {
      const marca = leidoHasta.get(m.conversacion_id);
      if (m.autor_id !== user.id && (!marca || m.created_at > marca)) pendientes++;
    }

    fijarSinLeerChatPanel(pendientes);
  }, []);

  useEffect(() => {
    cargar();

    const supabase = createClient();
    // Los eventos llegan solo de conversaciones propias (RLS) — con
    // cada mensaje nuevo se recalcula el contador.
    const canal = supabase
      .channel("chat-flotante")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        () => cargar(),
      )
      .subscribe();

    const alVolver = () => {
      if (document.visibilityState === "visible") cargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    const respaldo = setInterval(cargar, 60000);

    return () => {
      supabase.removeChannel(canal);
      document.removeEventListener("visibilitychange", alVolver);
      clearInterval(respaldo);
    };
  }, [cargar, pathname]);

  // Con la ventana abierta, Escape la cierra (como cualquier modal).
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarChatPanel();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  /** Abre un hilo adentro del panel: trae los mensajes y marca leído. */
  const abrirHilo = useCallback(
    async (conversacionId: string, titulo: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: mensajesData } = await supabase
        .from("mensajes")
        .select("id, conversacion_id, autor_id, texto, created_at")
        .eq("conversacion_id", conversacionId)
        .order("created_at", { ascending: true });

      await supabase.from("conversacion_lecturas").upsert(
        {
          conversacion_id: conversacionId,
          usuario_id: user.id,
          leido_hasta: new Date().toISOString(),
        },
        { onConflict: "conversacion_id,usuario_id" },
      );

      setHilo({
        conversacionId,
        titulo,
        miId: user.id,
        mensajes: (mensajesData ?? []) as Mensaje[],
      });
      cargar();
    },
    [cargar],
  );

  /** La lista de conversaciones, versión compacta de la bandeja. */
  const cargarLista = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Solo las activas: las resueltas viven en /mensajes ("Ver todo")
    // y vuelven solas acá si llega un mensaje nuevo (trigger de 0054).
    const { data: convData } = await supabase
      .from("conversaciones")
      .select(
        "id, reserva_id, rancho_id, cliente_id, proveedor_id, created_at, ranchos(nombre, foto_url, vertical, categoria, slug), reservas(nombre)",
      )
      .eq("resuelta", false);
    const conversaciones = (convData ?? []) as unknown as {
      id: string;
      reserva_id: string | null;
      rancho_id: string;
      cliente_id: string;
      proveedor_id: string;
      created_at: string;
      ranchos: {
        nombre: string;
        foto_url: string | null;
        vertical: string | null;
        categoria: string | null;
        slug: string | null;
      } | null;
      reservas: { nombre: string | null } | null;
    }[];
    if (conversaciones.length === 0) {
      setFilas([]);
      return;
    }

    const ids = conversaciones.map((c) => c.id);
    const [
      { data: mensajesData },
      { data: lecturasData },
      { data: ocultasData },
      { data: contactosData },
    ] = await Promise.all([
      supabase
        .from("mensajes")
        .select("conversacion_id, autor_id, texto, created_at")
        .in("conversacion_id", ids)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("conversacion_lecturas")
        .select("conversacion_id, leido_hasta")
        .eq("usuario_id", user.id),
      // Los chats eliminados de la bandeja (0040) tampoco salen acá.
      supabase
        .from("conversacion_ocultas")
        .select("conversacion_id, oculta_desde")
        .eq("usuario_id", user.id),
      supabase.from("conversaciones_contacto").select("conversacion_id, nombre_contacto"),
    ]);

    const contacto = new Map<string, string>(
      ((contactosData ?? []) as { conversacion_id: string; nombre_contacto: string | null }[])
        .filter((c) => !!c.nombre_contacto)
        .map((c) => [c.conversacion_id, c.nombre_contacto as string]),
    );
    const leidoHasta = new Map<string, string>(
      ((lecturasData ?? []) as { conversacion_id: string; leido_hasta: string }[]).map(
        (l) => [l.conversacion_id, l.leido_hasta],
      ),
    );
    const ocultaDesde = new Map<string, string>(
      ((ocultasData ?? []) as { conversacion_id: string; oculta_desde: string }[]).map(
        (o) => [o.conversacion_id, o.oculta_desde],
      ),
    );

    const ultimo = new Map<string, { autor_id: string; texto: string; created_at: string }>();
    const pendientes = new Map<string, number>();
    for (const m of (mensajesData ?? []) as {
      conversacion_id: string;
      autor_id: string;
      texto: string;
      created_at: string;
    }[]) {
      if (!ultimo.has(m.conversacion_id)) ultimo.set(m.conversacion_id, m);
      const marca = leidoHasta.get(m.conversacion_id);
      if (m.autor_id !== user.id && (!marca || m.created_at > marca)) {
        pendientes.set(m.conversacion_id, (pendientes.get(m.conversacion_id) ?? 0) + 1);
      }
    }

    setFilas(
      conversaciones
        .map((c) => {
          const soyCliente = c.cliente_id === user.id;
          const ult = ultimo.get(c.id) ?? null;
          return {
            id: c.id,
            titulo: soyCliente
              ? (c.ranchos?.nombre ?? "Conversación")
              : c.reservas?.nombre || contacto.get(c.id) || "Cliente interesado",
            subtitulo: c.reserva_id ? "Reserva" : "Consulta directa",
            foto: c.ranchos?.foto_url ?? null,
            ultimoTexto: ult
              ? `${ult.autor_id === user.id ? "Vos: " : ""}${ult.texto}`
              : "Sin mensajes todavía.",
            actividad: ult?.created_at ?? c.created_at,
            pendientes: pendientes.get(c.id) ?? 0,
            categoria: categorizarConversacion({
              proveedorId: c.proveedor_id,
              miId: user.id,
              ranchoSlug: c.ranchos?.slug ?? "",
              vertical: c.ranchos?.vertical ?? "eventos",
              categoria: c.ranchos?.categoria ?? "otros",
            }),
          };
        })
        // Eliminado de la bandeja = eliminado también de esta lista,
        // mientras no llegue algo nuevo que lo reviva.
        .filter((f) => {
          const oculta = ocultaDesde.get(f.id);
          return !oculta || f.actividad > oculta;
        })
        .sort((a, b) => (a.actividad < b.actividad ? 1 : -1)),
    );
  }, []);

  /**
   * "✓ Resuelto": archiva la conversación para ambos lados (columna
   * `resuelta` de 0054 — la RLS deja a cualquier participante). Sale
   * de la lista de una; si el update falla, se recarga y reaparece.
   *
   * Archivar cuenta como "ya lo vi": se marca leído también. Sin esto,
   * si el hilo tenía mensajes sin leer, esos pendientes se quedaban
   * sumando en la burbuja para siempre — el hilo ya no salía en ningún
   * lado desde donde abrirlo y bajarlos.
   */
  const marcarResuelta = useCallback(
    async (conversacionId: string) => {
      setFilas((prev) => prev.filter((f) => f.id !== conversacionId));
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("conversaciones")
        .update({ resuelta: true })
        .eq("id", conversacionId);
      if (error) {
        cargarLista();
        return;
      }
      if (user) {
        await supabase.from("conversacion_lecturas").upsert(
          {
            conversacion_id: conversacionId,
            usuario_id: user.id,
            leido_hasta: new Date().toISOString(),
          },
          { onConflict: "conversacion_id,usuario_id" },
        );
      }
      cargar();
    },
    [cargar, cargarLista],
  );

  /** Abre (o crea) el hilo de consulta con el negocio de esta página. */
  const abrirConsultaProveedor = useCallback(
    async (ranchoId: string, nombre: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSinSesion(true);
        return;
      }

      const { data: existente } = await supabase
        .from("conversaciones")
        .select("id")
        .eq("rancho_id", ranchoId)
        .eq("cliente_id", user.id)
        .is("reserva_id", null)
        .maybeSingle();

      let conversacionId = existente?.id as string | undefined;
      if (!conversacionId) {
        const { data: creada } = await supabase
          .from("conversaciones")
          .insert({ rancho_id: ranchoId })
          .select("id")
          .single();
        conversacionId = creada?.id as string | undefined;
        if (!conversacionId) {
          // Carrera (dos pestañas) o negocio propio: se reintenta leer.
          const { data: reintento } = await supabase
            .from("conversaciones")
            .select("id")
            .eq("rancho_id", ranchoId)
            .eq("cliente_id", user.id)
            .is("reserva_id", null)
            .maybeSingle();
          conversacionId = reintento?.id as string | undefined;
        }
      }

      if (conversacionId) await abrirHilo(conversacionId, nombre);
    },
    [abrirHilo],
  );

  /** Lo que carga el panel la primera vez que se abre en esta visita:
   * sesión anónima si hace falta (solo con un proveedor en pantalla),
   * el hilo directo con ESE negocio, o la lista con pestañas.
   *
   * Preguntarle algo a un negocio no debería pedir cuenta: si no hay
   * sesión, se abre una anónima al toque (misma fila real en
   * auth.users, mismas políticas RLS de siempre — no es un chat sin
   * dueño, es una cuenta que todavía no puso su nombre). Esto requiere
   * tener "Anonymous sign-ins" prendido en Supabase → Authentication →
   * Providers; si está apagado, `signInAnonymously` falla y se cae al
   * cartel de "iniciá sesión" de siempre. La bandeja completa (sin
   * negocio puntual) sí sigue pidiendo cuenta real. */
  const abrirContenido = useCallback(async () => {
    setSinSesion(false);
    setHilo(null);
    setCargandoPanel(true);
    try {
      const supabase = createClient();
      let {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user && proveedor) {
        const { data } = await supabase.auth.signInAnonymously();
        user = data.user;
      }
      if (!user) {
        setSinSesion(true);
        return;
      }
      if (proveedor) {
        await abrirConsultaProveedor(proveedor.ranchoId, proveedor.nombre);
      } else {
        await cargarLista();
      }
    } finally {
      setCargandoPanel(false);
    }
  }, [proveedor, abrirConsultaProveedor, cargarLista]);

  // El panel lo puede abrir el ícono del header (otro árbol de
  // componentes) o la burbuja propia de esta página — cualquiera que
  // sea, cuando `abierto` pasa de false a true toca cargar contenido.
  const yaAbiertoRef = useRef(false);
  useEffect(() => {
    if (abierto && !yaAbiertoRef.current) {
      void abrirContenido();
    }
    yaAbiertoRef.current = abierto;
  }, [abierto, abrirContenido]);

  const categoriasConDatos = useMemo(() => {
    const presentes = new Set(filas.map((f) => f.categoria));
    return ORDEN_CATEGORIAS_CHAT.filter((c) => presentes.has(c));
  }, [filas]);
  const tabActivaEfectiva =
    tabActiva && categoriasConDatos.includes(tabActiva) ? tabActiva : (categoriasConDatos[0] ?? "negocio");
  const cantidadPorCategoria = useMemo(() => {
    const mapa: Record<CategoriaChat, number> = {
      negocio: 0,
      invitaciones: 0,
      salones: 0,
      citas: 0,
      otros: 0,
    };
    filas.forEach((f) => {
      mapa[f.categoria]++;
    });
    return mapa;
  }, [filas]);
  const filasVisibles = filas.filter((f) => f.categoria === tabActivaEfectiva);

  return (
    <>
      {abierto && (
        <div
          role="dialog"
          aria-label="Chat"
          className="anim-panel-entrar fixed bottom-20 right-4 z-50 flex h-[480px] max-h-[calc(100dvh-100px)] w-[360px] max-w-[calc(100vw-28px)] flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-white shadow-[0_18px_50px_rgba(16,26,44,0.28)] lg:bottom-6 lg:right-6"
        >
          {/* Cabecera navy, como los chats de soporte en vivo. */}
          <div className="flex items-center gap-2.5 bg-aventurea-navy px-4 py-3 text-white">
            {hilo && !proveedor && (
              <button
                type="button"
                onClick={() => {
                  setHilo(null);
                  cargarLista();
                }}
                aria-label="Volver a tus conversaciones"
                className="-ml-1 rounded-full p-1 hover:bg-white/10"
              >
                ←
              </button>
            )}
            <p className="min-w-0 flex-1 truncate text-[14px] font-bold">
              {hilo ? hilo.titulo : "Mensajes"}
            </p>
            <Link
              href="/mensajes"
              onClick={() => cerrarChatPanel()}
              className="shrink-0 text-[11.5px] font-bold text-white/70 hover:text-white"
            >
              Ver todo
            </Link>
            <button
              type="button"
              onClick={() => cerrarChatPanel()}
              aria-label="Cerrar el chat"
              className="shrink-0 rounded-full p-1 text-[16px] leading-none hover:bg-white/10"
            >
              ×
            </button>
          </div>

          {cargandoPanel ? (
            <div className="flex flex-1 items-center justify-center text-[13px] text-aventurea-ink-soft">
              Abriendo tu chat...
            </div>
          ) : sinSesion ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-[13.5px] text-aventurea-ink-soft">
                Iniciá sesión para escribirle
                {proveedor ? ` a ${proveedor.nombre}` : " a los negocios"} por el chat.
              </p>
              <Link
                href="/cuenta"
                className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13px] font-bold text-white hover:bg-aventurea-navy-2"
              >
                Iniciar sesión
              </Link>
            </div>
          ) : hilo ? (
            <div className="flex flex-1 flex-col overflow-hidden p-2.5">
              <HiloChat
                conversacionId={hilo.conversacionId}
                miId={hilo.miId}
                mensajesIniciales={hilo.mensajes}
              />
            </div>
          ) : filas.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="px-6 text-center text-[13px] text-aventurea-ink-soft">
                Todavía no tenés conversaciones. Entrá a la página de un
                negocio y escribile desde esta misma burbuja.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="relative shrink-0 border-b border-aventurea-line px-3 py-2">
                <button
                  type="button"
                  onClick={() => setSelectorAbierto((v) => !v)}
                  aria-expanded={selectorAbierto}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-aventurea-line bg-aventurea-cream-2/60 px-3 py-2 text-[12.5px] font-bold text-aventurea-ink"
                >
                  <span>
                    {CATEGORIA_CHAT_LABEL[tabActivaEfectiva]}
                    {cantidadPorCategoria[tabActivaEfectiva] > 0 && (
                      <span className="ml-1.5 font-normal text-aventurea-ink-soft">
                        {cantidadPorCategoria[tabActivaEfectiva]}
                      </span>
                    )}
                  </span>
                  <IconChevronDown
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${selectorAbierto ? "rotate-180" : ""}`}
                  />
                </button>

                {selectorAbierto && (
                  <>
                    <button
                      type="button"
                      aria-label="Cerrar selector de categoría"
                      onClick={() => setSelectorAbierto(false)}
                      className="fixed inset-0 z-10 cursor-default"
                    />
                    <div className="absolute left-3 right-3 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-aventurea-line bg-white shadow-xl">
                      {ORDEN_CATEGORIAS_CHAT.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setTabActiva(cat);
                            setSelectorAbierto(false);
                          }}
                          className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] font-bold transition-colors ${
                            cat === tabActivaEfectiva
                              ? "bg-aventurea-navy text-white"
                              : "text-aventurea-ink hover:bg-aventurea-cream-2"
                          }`}
                        >
                          {CATEGORIA_CHAT_LABEL[cat]}
                          {cantidadPorCategoria[cat] > 0 && (
                            <span
                              className={cat === tabActivaEfectiva ? "text-white/70" : "text-zinc-400"}
                            >
                              {cantidadPorCategoria[cat]}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {filasVisibles.length === 0 ? (
                  <p className="mt-10 px-6 text-center text-[13px] text-aventurea-ink-soft">
                    No tenés conversaciones acá todavía.
                  </p>
                ) : (
                  filasVisibles.map((f) => (
                    <div
                      key={f.id}
                      className="flex w-full items-center gap-2 border-b border-aventurea-line/60 pr-2 hover:bg-aventurea-cream-2/60"
                    >
                      <button
                        type="button"
                        onClick={() => abrirHilo(f.id, f.titulo)}
                        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left"
                      >
                        <div
                          className="h-10 w-10 shrink-0 rounded-full bg-aventurea-cream-2 bg-cover bg-center"
                          style={f.foto ? { backgroundImage: `url(${f.foto})` } : undefined}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-bold text-aventurea-ink">
                            {f.titulo}
                            <span className="ml-1.5 text-[11px] font-normal text-aventurea-ink-soft">
                              {f.subtitulo}
                            </span>
                          </p>
                          <PreviewMensaje
                            texto={f.ultimoTexto}
                            className="block truncate text-[12.5px] text-aventurea-ink-soft"
                          />
                        </div>
                        {f.pendientes > 0 && (
                          <span className="flex h-[20px] min-w-[20px] shrink-0 items-center justify-center rounded-full bg-aventurea-orange px-1 text-[10.5px] font-bold text-white">
                            {f.pendientes > 99 ? "99+" : f.pendientes}
                          </span>
                        )}
                      </button>
                      {/* Despeja la bandeja sin abrir el hilo; si llega un
                          mensaje nuevo, la conversación vuelve sola. */}
                      <button
                        type="button"
                        onClick={() => marcarResuelta(f.id)}
                        title="Marcar como resuelta y archivar"
                        className="shrink-0 rounded-lg border border-aventurea-line px-2 py-0.5 text-[10.5px] font-bold text-aventurea-ink-soft hover:border-aventurea-green hover:text-aventurea-green"
                      >
                        ✓ Resuelto
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {proveedor && (
        <button
          type="button"
          onClick={alternarChatPanel}
          aria-label={
            sinLeer > 0 ? `Chateá con ${proveedor.nombre}: ${sinLeer} sin leer` : `Chateá con ${proveedor.nombre}`
          }
          aria-expanded={abierto}
          className="group fixed bottom-20 right-5 z-50 flex items-center gap-0 lg:bottom-6 lg:right-6"
        >
          {!abierto && (
            <span className="mr-2.5 hidden max-w-[220px] truncate rounded-xl border border-aventurea-line bg-aventurea-surface px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink shadow-[0_4px_14px_rgba(16,26,44,0.14)] sm:block">
              ¿Dudas? Escribile a {proveedor.nombre}
            </span>
          )}
          <span
            className={`relative flex h-[52px] items-center justify-center rounded-full border border-white/20 bg-black/35 text-white shadow-[0_6px_20px_rgba(16,26,44,0.35)] backdrop-blur-md transition-transform group-hover:scale-105 ${
              abierto ? "w-[52px]" : "gap-2 pl-4 pr-5"
            }`}
          >
            {abierto ? (
              <span className="text-[22px] leading-none">×</span>
            ) : (
              <>
                <IconChatBubble className="h-5 w-5 shrink-0" />
                <span className="text-[13.5px] font-bold">Mensajes</span>
              </>
            )}
            {sinLeer > 0 && !abierto && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-aventurea-orange px-1 text-[11px] font-bold text-white">
                {sinLeer > 99 ? "99+" : sinLeer}
              </span>
            )}
          </span>
        </button>
      )}
    </>
  );
}
