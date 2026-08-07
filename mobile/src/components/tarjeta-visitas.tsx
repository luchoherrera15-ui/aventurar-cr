import { useEffect, useRef, useState } from "react";
import { PruebaSocial } from "@/components/ui";
import type { Vertical } from "@/constants/theme";
import {
  describirVisitas,
  leerVisitas,
  registrarVisita,
  type AvisoVisitas,
} from "@/lib/visitas";

/**
 * La tarjetita de "12 personas visitaron este sitio hoy" en la página
 * pública de un negocio — la gemela de la de /web.
 *
 * Hace las dos cosas de un tirón, en este orden a propósito:
 *  1. anota la visita de quien acaba de abrir la pantalla, y
 *  2. lee el resumen — así el número que se ve ya incluye a esta
 *     persona, que efectivamente entró.
 *
 * Se monta una sola vez por apertura (el `ref` corta el doble efecto
 * del modo estricto); volver a entrar el mismo día no suma nada porque
 * la llave primaria de la tabla ya cuenta una visita por persona y día.
 *
 * Si no hay número que valga la pena mostrar — o si la base todavía no
 * tiene corrida la 0107 — devuelve `null` y la pantalla queda igual
 * que antes. Ver la regla de los 3 en `lib/visitas.ts`.
 */
export default function TarjetaVisitas({
  ranchoId,
  vertical = "eventos",
}: {
  ranchoId: string;
  /** Manda el color del punto; el de la vertical de la pantalla. */
  vertical?: Vertical;
}) {
  const [aviso, setAviso] = useState<AvisoVisitas | null>(null);
  const yaContado = useRef<string | null>(null);

  useEffect(() => {
    if (!ranchoId) return;
    let vivo = true;
    const hayQueContar = yaContado.current !== ranchoId;
    yaContado.current = ranchoId;

    (async () => {
      if (hayQueContar) await registrarVisita(ranchoId);
      const resumen = await leerVisitas(ranchoId);
      if (vivo) setAviso(describirVisitas(resumen));
    })();

    return () => {
      vivo = false;
    };
  }, [ranchoId]);

  if (!aviso) return null;
  return <PruebaSocial numero={aviso.numero} texto={aviso.texto} vertical={vertical} />;
}
