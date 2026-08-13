import { Bloque } from "../../esqueleto";

/**
 * Pantalla de carga del panel del dueño.
 *
 * Es la pantalla que más se abre del sitio y la que más esperaba: hacía
 * NUEVE tandas de consultas en cascada (~500 ms de puro esperar a la
 * base a ~55 ms el viaje, medido). El page.tsx ya las junta en una sola
 * tanda; esto resuelve la otra mitad del problema — que hasta que la
 * base no contestaba, Next no podía mandar ni el `<head>`, así que el
 * navegador ni siquiera sabía qué CSS pedir.
 *
 * Calca el tablero real: identidad del negocio arriba, la fila de
 * pestañas y las tarjetas de números — para que nada salte de lugar
 * cuando llega el contenido de verdad.
 */
export default function CargandoPanelNegocio() {
  return (
    <main className="w-full px-5 py-8 lg:px-8">
      <Bloque className="h-4 w-[190px]" />

      <div className="mt-4 overflow-hidden rounded-3xl border border-aventurea-line bg-aventurea-surface p-5 shadow-sm sm:p-7">
        {/* Identidad: foto cuadrada, nombre, estado y categoría */}
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Bloque className="h-16 w-16 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <Bloque className="h-5 w-[240px]" />
            <Bloque className="mt-2 h-3.5 w-[320px] max-w-full" />
          </div>
          <Bloque className="h-10 w-[150px] rounded-xl" />
        </header>

        {/* Las pestañas del panel */}
        <div className="mt-6 flex gap-2 overflow-hidden border-b border-aventurea-line pb-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Bloque key={i} className="h-9 w-[110px] shrink-0 rounded-lg" />
          ))}
        </div>

        {/* La fila de números del mes */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-aventurea-line bg-white p-5"
            >
              <Bloque className="h-3 w-20" />
              <Bloque className="mt-3 h-7 w-28" />
            </div>
          ))}
        </div>

        {/* La agenda / el listado grande de abajo */}
        <div className="mt-6 rounded-2xl border border-aventurea-line bg-white p-5">
          <Bloque className="h-4 w-40" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Bloque className="h-11 w-11 shrink-0 rounded-xl" />
                <div className="flex-1">
                  <Bloque className="h-3.5 w-1/3" />
                  <Bloque className="mt-2 h-3 w-1/4" />
                </div>
                <Bloque className="h-3.5 w-20 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
