"use client";

import dynamic from "next/dynamic";

/**
 * El Asistente Boki en carga diferida.
 *
 * `planificador.tsx` son ~41 KB de fuente (más `motor.ts` y `tipos.ts`)
 * que hoy viajan en el bundle inicial de /eventos, y que no pintan
 * absolutamente nada hasta que alguien toca el chip "Asistente Boki":
 * el modal vive detrás de `{abierto && …}` y `abierto` solo se enciende
 * cuando el hash de la URL es `#boki`. O sea: JavaScript que el 100% de
 * las visitas baja, parsea y ejecuta, y que casi nadie usa.
 *
 * Con `ssr: false` no cambia nada de lo que se ve —el componente ya
 * renderizaba `null` en el servidor— y el chunk se pide después de la
 * hidratación. El que entre directo a /eventos#boki ve el asistente un
 * instante más tarde; el resto arranca con menos JS en el camino
 * crítico. Mismo patrón que `chat-flotante-lazy.tsx`.
 *
 * PARA QUE ESTO RINDA hay que cambiar UNA línea en
 * `src/app/eventos/page.tsx`:
 *
 *   - import Planificador from "@/components/planificador/planificador";
 *   + import Planificador from "@/components/planificador/planificador-lazy";
 *
 * (esa página es de otro dueño en este reparto, por eso el cambio no
 * está hecho acá).
 */
export default dynamic(() => import("./planificador"), { ssr: false });
