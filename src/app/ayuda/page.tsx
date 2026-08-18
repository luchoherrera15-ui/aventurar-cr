import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { obtenerHiloVisitante } from "@/lib/ayuda-general/acciones";
import { idDeCuentaDeBookea } from "@/lib/lealtad/personas";
import SiteHeader from "@/components/site-header";
import ChatAyuda from "./chat-ayuda";

export const metadata: Metadata = {
  title: "Ayuda",
  description: "Escribile a la administración de Bookea y recibí respuesta en vivo, por acá mismo.",
};

/**
 * /ayuda — soporte general, cualquiera con la administración de Bookea.
 *
 * NO es la ayuda de diseño de tarjeta de /lealtad/panel/[id] (0149):
 * esa es un complemento de UN negocio que ya tiene tarjeta. Acá puede
 * escribir cualquiera — tenga cuenta, tenga negocio, o ninguna de las
 * dos cosas — así que el punto de partida no puede asumir sesión.
 *
 * `obtenerHiloVisitante()` ya resuelve TODA la identidad (sesión real
 * vs. cookie `bk_ayuda`) y devuelve el hilo si existe. Acá se agrega
 * SOLO un dato más, puramente de presentación: si hay sesión real, para
 * que `ChatAyuda` sepa que no tiene que pedir nombre y contacto antes
 * del primer mensaje (ver §1 del diseño: con sesión, esos datos salen
 * de `perfiles` adentro de `iniciarHilo`, sin formulario). Sin este
 * dato la página no podría distinguir "sesión real que todavía no
 * escribió" de "visitante nuevo sin cookie" — los dos casos devuelven
 * `hilo === null` por igual.
 *
 * `idDeCuentaDeBookea` (la MISMA función que usa `acciones.ts` para
 * decidir esto, reusada — no reinventada) es lo que hace que esto no
 * repita el error ya pagado: `auth.getUser()` solo devuelve `data.user`
 * truthy TAMBIÉN para una sesión anónima de Supabase, así que un simple
 * `!!user` habría tratado a alguien con `signInAnonymously()` (ej. el
 * chat flotante de otra página) como si tuviera una cuenta real y
 * hubiera que saltarse el formulario — exactamente la confusión que ya
 * costó cara una vez.
 */
export default async function AyudaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sesionActiva = idDeCuentaDeBookea(user) !== null;

  const hilo = await obtenerHiloVisitante();

  return (
    <>
      <SiteHeader breadcrumb="Ayuda" conPublicar={false} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:py-10">
        <div className="mb-5 sm:mb-7">
          <h1 className="text-[22px] font-extrabold text-aventurea-ink sm:text-[26px]">
            Hablá con Bookea
          </h1>
          <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
            Contanos qué necesitás y te contestamos por acá mismo, en vivo.
          </p>
        </div>
        <ChatAyuda hiloInicial={hilo} sesionActiva={sesionActiva} />
      </main>
    </>
  );
}
