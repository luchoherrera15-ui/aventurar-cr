"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  leerProveedorActual,
  leerProveedorActualServidor,
  suscribirProveedorActual,
} from "@/lib/proveedor-actual";
import { IconChatBubble } from "./icons";

/**
 * Burbuja de chat flotante, visible en todo el sitio: aparece apenas
 * la persona tiene al menos una conversación, y muestra en naranja
 * cuántos mensajes tiene sin leer. Toca → bandeja de mensajes.
 *
 * En la página de un proveedor la burbuja cambia de trabajo: aparece
 * siempre (aunque no haya conversaciones todavía) y abre el chat con
 * ESE negocio — quien está reservando y le entra una duda no tiene que
 * ir a buscar dónde escribirle.
 *
 * El conteo se refresca por Realtime (los INSERT de mensajes llegan
 * filtrados por RLS: solo los de tus conversaciones), al volver a la
 * pestaña, y con un respaldo cada minuto por si Realtime no conecta.
 */
export default function ChatFlotante() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
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
    if (!user) {
      setVisible(false);
      return;
    }

    const { data: convData } = await supabase.from("conversaciones").select("id");
    const ids = (convData ?? []).map((c) => c.id as string);
    if (ids.length === 0) {
      setVisible(false);
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

    setSinLeer(pendientes);
    setVisible(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial al montar, sin librería de data-fetching en este proyecto
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

  // Dentro de la mensajería la burbuja sobra (ya estás ahí). En la
  // página de un proveedor se muestra siempre — la consulta se puede
  // abrir sin tener conversaciones previas (y sin sesión: esa página
  // manda a iniciar sesión primero).
  if (pathname.startsWith("/mensajes")) return null;
  if (!visible && !proveedor) return null;

  return (
    <Link
      href={proveedor ? `/mensajes/consulta/${proveedor.ranchoId}` : "/mensajes"}
      aria-label={
        proveedor
          ? `Chateá con ${proveedor.nombre}`
          : sinLeer > 0
            ? `Mensajes: ${sinLeer} sin leer`
            : "Tus mensajes"
      }
      className="group fixed bottom-20 right-5 z-50 flex items-center gap-0 lg:bottom-6 lg:right-6"
    >
      {proveedor && (
        <span className="mr-2.5 hidden max-w-[220px] truncate rounded-full border border-aventurea-line bg-aventurea-surface px-3.5 py-2 text-[12.5px] font-bold text-aventurea-ink shadow-[0_4px_14px_rgba(16,26,44,0.14)] sm:block">
          ¿Dudas? Escribile a {proveedor.nombre}
        </span>
      )}
      <span className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-aventurea-navy text-white shadow-[0_6px_20px_rgba(16,26,44,0.35)] transition-transform group-hover:scale-105">
        <IconChatBubble className="h-6 w-6" />
        {sinLeer > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-aventurea-orange px-1 text-[11px] font-bold text-white">
            {sinLeer > 99 ? "99+" : sinLeer}
          </span>
        )}
      </span>
    </Link>
  );
}
