import type { Metadata } from "next";
import { IconoSalir } from "@/components/celebrar/iconos-celebrar";
import { EncabezadoPanel, TarjetaPanel } from "@/components/celebrar/panel/piezas";
import { miPerfilCelebrar } from "@/lib/celebrar/datos";
import { sesionCelebrar } from "@/lib/celebrar/sesion";
import { cerrarSesionCelebrar } from "../acciones-sesion";
import PerfilForm from "./perfil-form";

export const metadata: Metadata = { title: "Configuración" };

/**
 * La cuenta, vista desde CELEBRAR. El nombre y el correo son de la
 * identidad compartida; WhatsApp, país y moneda viven en
 * `celebrar_perfiles`. El correo no se edita desde acá a propósito,
 * como en el resto del sitio.
 */
export default async function ConfiguracionPage() {
  const [sesion, perfil] = await Promise.all([sesionCelebrar(), miPerfilCelebrar()]);

  return (
    <div className="grid gap-8">
      <EncabezadoPanel
        titulo="Configuración"
        descripcion="Tu cuenta y tus preferencias. Lo que cambiés acá aplica a todas tus celebraciones."
      />

      <TarjetaPanel>
        <h2 className="text-xl leading-tight text-(--c-tinta)">Tu cuenta</h2>
        <p className="mt-1 text-[14px] text-(--c-tinta-suave)">
          El nombre aparece como anfitrión en tus celebraciones. El país define la moneda de los precios.
        </p>
        <div className="mt-6">
          <PerfilForm nombre={sesion?.nombre ?? ""} correo={sesion?.email ?? ""} perfil={perfil} />
        </div>
      </TarjetaPanel>

      <TarjetaPanel>
        <h2 className="text-xl leading-tight text-(--c-tinta)">Forma de entrar</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-(--c-tinta-suave)">
          Con un código de 6 dígitos que te mandamos al correo cada vez que entrás. Sin contraseña que recordar.
        </p>
      </TarjetaPanel>

      <TarjetaPanel className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl leading-tight text-(--c-tinta)">Sesión</h2>
          <p className="mt-1 text-[14px] text-(--c-tinta-suave)">
            Cierra la sesión en este dispositivo. En los demás seguís conectado.
          </p>
        </div>
        <form action={cerrarSesionCelebrar}>
          <button type="submit" className="c-boton c-boton-secundario">
            <IconoSalir className="h-5 w-5" />
            Cerrar sesión
          </button>
        </form>
      </TarjetaPanel>
    </div>
  );
}
