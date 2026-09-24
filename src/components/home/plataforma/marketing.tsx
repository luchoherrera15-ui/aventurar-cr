import { Encabezado, Escenario, Marco, NotaDemo, Seccion } from "./piezas";

/**
 * MARKETING — con el «dónde» adentro de la frase.
 *
 * El módulo `marketing` del panel general está `disponible: false`: no
 * hay pantalla de marketing para cualquier negocio. Lo que sí existe y
 * corre son las campañas automáticas de Lealtad (0226). Por eso la
 * bajada termina en «desde Lealtad» — es el límite y el dato, en dos
 * palabras, en vez de un recuadro de letra chica.
 */

export default function Marketing() {
  return (
    <Seccion id="marketing">
      <Encabezado rotulo="Marketing" titulo="Escribiles sin acordarte vos.">
        Cuando alguien deja de venir, Bookea le manda tu promoción. Desde
        Lealtad, con lo que ya sabe de él.
      </Encabezado>

      <Escenario ancho="medio">
        <Marco>
          <div className="border-b border-[color:var(--linea)] px-6 py-4 text-left">
            <p className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-[color:var(--tinta-suave)]">
              Campaña automática
            </p>
            <p className="mt-1 text-[16px] font-extrabold text-[color:var(--tinta)]">
              Clientes que no vienen hace 60 días
            </p>
          </div>

          <div className="space-y-4 px-6 py-5 text-left">
            <div className="rounded-[14px] bg-[color:var(--acento)] px-5 py-4">
              <p className="text-[15px] font-semibold leading-snug text-white">
                ¡Te extrañamos! Volvé esta semana y tu corte lleva 15 % de
                descuento.
              </p>
              <p className="mt-2 text-[12px] text-white/75">
                Silence Barber · vence el domingo
              </p>
            </div>
            <p className="text-[13.5px] text-[color:var(--tinta-suave)]">
              Se manda una sola vez, al que cumple la condición.
            </p>
          </div>
        </Marco>
        <NotaDemo>Campaña de muestra. El texto lo escribís vos.</NotaDemo>
      </Escenario>
    </Seccion>
  );
}
