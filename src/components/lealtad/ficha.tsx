"use client";

import { EYEBROW_FICHA, NOTA, TITULO_CAPITULO } from "./ficha-tokens";
import VistaPase, { type DatosVista } from "./vista-pase";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA FICHA DE LA TARJETA — el chasis de la pantalla de diseño
 * ════════════════════════════════════════════════════════════════════
 *
 * Reemplaza a `Bloque`, que dibujaba cinco tarjetas blancas iguales con
 * un circulito numerado. El problema de aquello no era el estilo de la
 * caja: era que TODO pesaba lo mismo. Cinco cajas idénticas, trece
 * rótulos idénticos de 9,5 px, y ninguna pista de por dónde empezar.
 * El dueño lo dijo dos veces —«sigue viéndose exactamente igual»— y
 * tenía razón las dos.
 *
 * Esto es una HOJA: una sola superficie continua, con capítulos
 * separados por una línea fina y aire de verdad entre ellos. Los
 * números cuelgan en el margen y no encerrados en una píldora, la nota
 * de cada capítulo vive en una columna al costado en vez de apretada
 * bajo el título, y el nombre de la tarjeta ES el título de la ficha.
 *
 * El pase se muda a una placa navy sólida con sus datos derivados al
 * pie: deja de ser «una vista previa al costado» y pasa a ser el
 * resultado, con presencia.
 */

/**
 * UN CAPÍTULO DE LA FICHA.
 *
 * Sin caja, sin fondo propio y sin radio: una línea arriba, aire, y la
 * cifra colgando en el margen izquierdo.
 *
 * La nota se escribe UNA vez: en escritorio cae en la segunda columna
 * de la grilla, y en teléfono queda entre el título y los controles por
 * el orden natural del DOM. Duplicarla para las dos pantallas sería
 * duplicar el texto que hay que mantener.
 */
export function Apartado({
  numero,
  capitulo,
  titulo,
  nota,
  compacto = false,
  children,
}: {
  numero: number;
  capitulo: string;
  titulo: string;
  nota?: React.ReactNode;
  /**
   * MENOS AIRE, PARA QUE EL PASO ENTRE (dueño, 3 sep 2026: «ajustar
   * tamaños, hacer más pequeño las cosas… que no haya que hacer
   * scroll»).
   *
   * El respiro normal —32 px arriba y abajo, 44 en pantalla grande— es
   * lo que hace que el EDITOR DEL PANEL se lea como un documento, y ahí
   * se queda: ese editor crece hacia abajo y puede permitírselo.
   *
   * El asistente de alta no: tiene un alto fijo y cada paso tiene que
   * caber entero. Acá el mismo aire es lo que empuja el contenido fuera
   * del marco, así que se recorta a la mitad. No cambia ni la
   * tipografía ni la grilla: solo el espacio.
   */
  compacto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`border-t border-bookea-linea ${
        compacto ? "px-5 py-5 sm:px-8 sm:py-6 lg:px-10" : "px-5 py-8 sm:px-10 sm:py-11 lg:px-12"
      }`}
    >
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_190px] lg:gap-x-10">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="flex items-baseline gap-3">
            {/* La cifra es DECORATIVA y por eso puede ir en el color de
                línea: quien informa de verdad es el nombre del capítulo,
                que va en gris legible. Va `aria-hidden` porque «3» leído
                en voz alta antes del título no aporta nada. */}
            <span
              aria-hidden
              className="hidden shrink-0 text-[34px] font-extrabold leading-none tracking-[-0.04em] text-bookea-linea lg:-ml-9 lg:block"
            >
              {numero}
            </span>
            <span className={EYEBROW_FICHA}>
              <span aria-hidden className="lg:hidden">
                {numero} ·{" "}
              </span>
              {capitulo}
            </span>
          </div>
          <h2 className={`${TITULO_CAPITULO} mt-2.5`}>{titulo}</h2>
        </div>

        {nota && (
          <aside className="mt-2.5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-1">
            <p className={`max-w-[56ch] ${NOTA} lg:border-l lg:border-bookea-linea lg:pl-4`}>
              {nota}
            </p>
          </aside>
        )}

        {/* 24 px entre campos y no 16: la mitad del efecto «documento»
            está en este salto. Apretados, vuelven a leerse como una
            planilla. */}
        <div
          className={`min-w-0 lg:col-start-1 lg:row-start-2 ${
            compacto ? "mt-4 space-y-4" : "mt-6 space-y-6"
          }`}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

/**
 * LA PORTADA — el nombre de la tarjeta ES el título de la ficha.
 *
 * Antes era un campo más, con su rótulo de 9,5 px, perdido entre el
 * selector de tipo y los colores. Acá arriba y en 38 px, la pantalla
 * abre diciendo QUÉ ES esta tarjeta.
 */
export function Portada({
  valor,
  alCambiar,
  placeholder,
  bloqueada,
  acento,
  metadatos,
  nota,
  rotulo,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  placeholder: string;
  bloqueada: boolean;
  /**
   * El color del NEGOCIO, no el nuestro. La ficha se tiñe con la marca
   * de quien la está armando, y cambiar el estilo la repinta en vivo —
   * que es una forma más de que se note que la elección hizo algo.
   */
  acento: string;
  metadatos: readonly string[];
  nota?: React.ReactNode;
  /**
   * El indicador VISIBLE arriba del campo (pedido del dueño, 30 ago
   * 2026: que el «Café Aroma» de ejemplo diga qué es). Sin él, el
   * rótulo queda solo para el lector de pantalla, como siempre.
   */
  rotulo?: string;
}) {
  return (
    <header className="px-5 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-11 lg:px-12">
      <span
        aria-hidden
        className="block h-[3px] w-12 rounded-full"
        style={{ background: acento }}
      />
      <label className="mt-5 block">
        {/* Con `rotulo` el indicador SE VE (alta pública: «Nombre de tu
            negocio» arriba del ejemplo Café Aroma); sin él existe solo
            para el lector de pantalla, como siempre en el panel. */}
        {rotulo ? (
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-bookea-gris">
            {rotulo}
          </span>
        ) : (
          <span className="sr-only">Nombre de la tarjeta</span>
        )}
        <input
          required
          value={valor}
          onChange={(e) => alCambiar(e.target.value.slice(0, 80))}
          disabled={bloqueada}
          maxLength={80}
          placeholder={placeholder}
          className="titulo w-full border-0 border-b border-transparent bg-transparent p-0 pb-1 text-[30px] leading-[1.06] text-bookea-azul transition-colors placeholder:text-bookea-linea hover:border-bookea-linea focus:border-bookea-azul disabled:text-bookea-gris sm:text-[38px]"
        />
      </label>
      {metadatos.length > 0 && (
        <p className="mt-3.5 text-[12.5px] leading-relaxed text-bookea-gris">
          {metadatos.map((d, i) => (
            <span key={d}>
              {i > 0 && (
                <span aria-hidden className="px-2 text-bookea-linea">
                  ·
                </span>
              )}
              {d}
            </span>
          ))}
        </p>
      )}
      {nota && (
        <p className="mt-3 max-w-[62ch] text-[12.5px] leading-relaxed text-bookea-gris">{nota}</p>
      )}
    </header>
  );
}

/**
 * LA PLACA DEL PASE — la columna derecha, con presencia.
 *
 * `sobre-oscuro` invierte el anillo de foco a blanco (adentro viven las
 * pestañas Apple/Google), y `data-tema="oscuro"` le da `color-scheme:
 * dark` a lo que pinta el navegador y no la hoja de estilos.
 *
 * `superficie="oscura"` ya existía en `VistaPase`: es un prop, no un
 * componente nuevo. Hasta hoy se le pasaba «clara» porque el pase vivía
 * suelto sobre el fondo de la página.
 */
export function PlacaPase({
  datos,
  derivados,
  anchoTelefono,
  desnuda = false,
}: {
  datos: DatosVista;
  /** Los cuatro datos al pie: meta, filas, tamaño y contraste. */
  derivados: readonly { rotulo: string; valor: string }[];
  /** Ancho del teléfono en px. Ausente = el de siempre (224). El alta
   *  pública lo baja para que la placa entre entera en la ventana. */
  anchoTelefono?: number;
  /**
   * SIN LA CAJA NAVY (dueño, 3 sep 2026: «eliminar ese rectángulo
   * azul»).
   *
   * La placa nació como una pieza con presencia: fondo navy profundo,
   * sombra flotante y la ficha técnica al pie. Funciona en una pantalla
   * que respira — pero en el asistente de alta compite con la hoja
   * blanca de al lado y, sobre todo, ALTO: la caja suma su rótulo, su
   * padding y su tabla de datos alrededor de un teléfono que ya es la
   * pieza más alta de la pantalla. Ese alto es el que obligaba a
   * hacer scroll.
   *
   * Desnuda, el teléfono flota sobre el fondo de la página y ocupa
   * exactamente lo que mide. La ficha técnica se sigue mostrando si
   * llega, pero en tinta normal sobre claro.
   */
  desnuda?: boolean;
}) {
  if (desnuda) {
    return (
      <div>
        <p className="mb-3 text-[11px] font-extrabold uppercase leading-none tracking-[0.16em] text-bookea-gris">
          Así le llega al cliente
        </p>
        <VistaPase datos={datos} superficie="clara" marco="telefono" />
        {derivados.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-bookea-linea pt-3.5">
            {derivados.map((d) => (
              <div key={d.rotulo}>
                <dt className="text-[10.5px] font-bold uppercase leading-none tracking-[0.12em] text-bookea-gris">
                  {d.rotulo}
                </dt>
                <dd className="mt-1 text-[12.5px] font-bold tabular-nums text-bookea-tinta">
                  {d.valor}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    );
  }

  return (
    <div
      className="sobre-oscuro rounded-3xl p-5 shadow-flotante"
      data-tema="oscuro"
      style={{ background: "var(--navy-profundo)" }}
    >
      <p className="mb-4 text-[11px] font-extrabold uppercase leading-none tracking-[0.16em] text-aventurea-rail">
        Así le llega al cliente
      </p>
      <VistaPase datos={datos} superficie="oscura" marco="telefono" anchoTelefono={anchoTelefono} />
      {derivados.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/10 pt-4">
          {derivados.map((d) => (
            <div key={d.rotulo}>
              <dt className="text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-aventurea-rail">
                {d.rotulo}
              </dt>
              <dd className="mt-1 text-[13px] font-bold tabular-nums text-white">{d.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
