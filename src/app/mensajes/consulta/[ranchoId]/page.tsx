"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Punto de entrada del "Preguntar por el chat": abre (o retoma) el
 * hilo de consulta del usuario con ese negocio y manda directo a la
 * conversación.
 *
 * Es un Client Component (no Server Component como antes) porque
 * preguntarle algo a un negocio no debería pedir cuenta: si no hay
 * sesión, se abre una anónima acá mismo con `signInAnonymously` —
 * eso solo se puede hacer desde el navegador (necesita escribir la
 * cookie de sesión, y un Server Component en su render no puede).
 * Requiere "Anonymous sign-ins" prendido en Supabase → Authentication
 * → Providers; si está apagado, se cae al link de "Iniciar sesión".
 */
export default function AbrirConsultaPage() {
  const { ranchoId } = useParams<{ ranchoId: string }>();
  const router = useRouter();
  const [estado, setEstado] = useState<"cargando" | "error">("cargando");

  useEffect(() => {
    let cancelado = false;

    async function abrir() {
      const supabase = createClient();
      let {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const { data } = await supabase.auth.signInAnonymously();
        user = data.user;
      }
      if (!user) {
        if (!cancelado) setEstado("error");
        return;
      }

      const { data: existente } = await supabase
        .from("conversaciones")
        .select("id")
        .eq("rancho_id", ranchoId)
        .eq("cliente_id", user.id)
        .is("reserva_id", null)
        .maybeSingle();

      if (existente) {
        router.replace(`/mensajes/hilo/${existente.id}`);
        return;
      }

      const { data: creada, error } = await supabase
        .from("conversaciones")
        .insert({ rancho_id: ranchoId })
        .select("id")
        .single();

      if (error || !creada) {
        // Carrera (dos pestañas a la vez) o negocio inexistente/propio.
        const { data: reintento } = await supabase
          .from("conversaciones")
          .select("id")
          .eq("rancho_id", ranchoId)
          .eq("cliente_id", user.id)
          .is("reserva_id", null)
          .maybeSingle();
        if (!reintento) {
          if (!cancelado) setEstado("error");
          return;
        }
        router.replace(`/mensajes/hilo/${reintento.id}`);
        return;
      }

      router.replace(`/mensajes/hilo/${creada.id}`);
    }

    abrir();
    return () => {
      cancelado = true;
    };
  }, [ranchoId, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      {estado === "cargando" ? (
        <p className="text-[13.5px] text-aventurea-ink-soft">Abriendo tu consulta...</p>
      ) : (
        <>
          <p className="text-[13.5px] text-aventurea-ink-soft">
            No pudimos abrir esta consulta.
          </p>
          <Link
            href="/cuenta"
            className="rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13px] font-bold text-white hover:bg-aventurea-navy-2"
          >
            Iniciar sesión
          </Link>
        </>
      )}
    </div>
  );
}
