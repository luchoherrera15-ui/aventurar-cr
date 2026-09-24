import { EncabezadoPanel, EstadoVacio, TarjetaPanel } from "@/components/celebrar/panel/piezas";
import TarjetaCelebracion from "@/components/celebrar/panel/tarjeta-celebracion";
import { EnlaceCelebrar } from "@/components/celebrar/rutas-cliente";
import { baseListaCelebrar, misCelebraciones, movimientosCreditos, saldoCreditos } from "@/lib/celebrar/datos";
import BalanceCreditos from "@/components/celebrar/panel/balance-creditos";
import { PRECIO_A_MEDIDA_CRC, PRECIO_PLANTILLA_CRC, colones, enColones } from "@/lib/celebrar/creditos";
import { PASOS } from "@/lib/celebrar/marca";
import { RUTA } from "@/lib/celebrar/rutas";
import { primerNombre, sesionCelebrar } from "@/lib/celebrar/sesion";

/**
 * Inicio del panel: las celebraciones de la persona (las tres más
 * recientes) o el estado vacío; al lado, lo que sigue y los créditos.
 * Ningún número inventado: lo que se ve sale de la base.
 */
export default async function InicioApp() {
  const [sesion, celebraciones, baseLista, saldo, movimientos] = await Promise.all([
    sesionCelebrar(),
    misCelebraciones(),
    baseListaCelebrar(),
    saldoCreditos(),
    movimientosCreditos(),
  ]);
  const nombre = primerNombre(sesion?.nombre ?? null);
  const activas = celebraciones.filter((c) => c.estado !== "archivada");

  return (
    <div className="grid gap-8">
      <EncabezadoPanel
        titulo={nombre ? `Hola, ${nombre}` : "Hola"}
        descripcion={
          activas.length
            ? `Tenés ${activas.length === 1 ? "una celebración" : `${activas.length} celebraciones`} en marcha.`
            : "Este es tu panel. Acá van a vivir tus celebraciones, los invitados que confirman, el álbum que llenan y los créditos con los que pagás cada cosa."
        }
        accion={
          <EnlaceCelebrar a={RUTA.appCrear} className="c-boton c-boton-primario">
            Crear celebración
          </EnlaceCelebrar>
        }
      />

      {!baseLista && (
        <p role="status" className="rounded-xl bg-(--c-coral-suave) px-4 py-3 text-[14px] leading-relaxed text-(--c-coral-tinta)">
          La base de datos de CELEBRAR todavía no está aplicada en este entorno (migración 0242).
          El panel se puede recorrer, pero crear y guardar no funcionan hasta aplicarla.
        </p>
      )}

      {activas.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no tenés celebraciones"
          texto="Empezá con lo básico: qué celebran, cuándo y dónde. El diseño, los invitados y el álbum se van sumando a esa misma celebración."
        />
      ) : (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl leading-tight text-(--c-tinta)">Tus celebraciones</h2>
            <EnlaceCelebrar a={RUTA.appCelebraciones} className="c-enlace text-[14px]">
              Ver todas
            </EnlaceCelebrar>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activas.slice(0, 3).map((c) => (
              <TarjetaCelebracion key={c.id} c={c} />
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
        <TarjetaPanel>
          <h2 className="text-xl leading-tight text-(--c-tinta)">Cómo funciona</h2>
          <ol className="mt-5 grid gap-5">
            {PASOS.map((p) => (
              <li key={p.numero} className="grid grid-cols-[3rem_1fr] gap-3">
                <span className="c-montserrat text-2xl font-extrabold text-(--c-azul)" aria-hidden="true">
                  {p.numero}
                </span>
                <div>
                  <p className="c-montserrat text-[15px] font-semibold text-(--c-tinta)">
                    {p.verbo}: {p.titulo}
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-(--c-tinta-suave)">{p.detalle}</p>
                </div>
              </li>
            ))}
          </ol>
        </TarjetaPanel>

        <div className="grid gap-6">
          <TarjetaPanel tono="marina" className="flex flex-col">
            <h2 className="text-xl leading-tight text-(--c-blanco)">Cuánto cuesta</h2>
            <p className="c-montserrat mt-3 text-5xl font-extrabold leading-none text-(--c-blanco)">
              {colones(PRECIO_PLANTILLA_CRC)} <span className="text-base font-semibold text-(--c-sobre-marino-suave)">por invitación</span>
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-(--c-sobre-marino-suave)">
              Crear, editar y probar es gratis: pagás recién al publicar. ¿La querés diseñada a medida por nuestro equipo? {colones(PRECIO_A_MEDIDA_CRC)}.
            </p>
            {saldo > 0 && <p className="mt-2 text-[13px] text-(--c-sobre-marino-suave)">Tenés {enColones(saldo)} a favor: se usan primero.</p>}
            <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <EnlaceCelebrar a={RUTA.appCreditos} className="c-boton c-boton-claro">
                Precios y pagos
              </EnlaceCelebrar>
            </div>
          </TarjetaPanel>
          <BalanceCreditos movimientos={movimientos} saldo={saldo} compacto />
        </div>
      </div>
    </div>
  );
}
