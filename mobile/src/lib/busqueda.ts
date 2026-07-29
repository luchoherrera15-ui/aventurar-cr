/**
 * Port a mano de `src/lib/busqueda.ts` de la web (paridad): la lupa
 * de Explorar entiende fechas en español — "3 de agosto", "03/08",
 * "mañana", "este viernes" — y esa parte se convierte en el filtro de
 * disponibilidad; el resto queda como búsqueda de texto normal.
 *
 * Autocontenido: la app no tiene la lib de fechas de la web, así que
 * los helpers de días viven acá mismo.
 */
export type BusquedaInterpretada = {
  /** Lo que queda para buscar por nombre/zona, ya sin la fecha. */
  texto: string;
  /** La fecha detectada (YYYY-MM-DD), o null si no se escribió una. */
  fecha: string | null;
};

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  // En Costa Rica se dice "setiembre"; se aceptan las dos formas.
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

// Palabras que acompañan a la pregunta por una fecha ("¿qué hay libre
// ese día?") pero que no buscan nada por sí mismas. Solo se quitan
// cuando SÍ se detectó una fecha.
const RELLENO_FECHA = new Set([
  "que",
  "hay",
  "libre",
  "libres",
  "disponible",
  "disponibles",
  "disponibilidad",
  "ese",
  "esa",
  "este",
  "esta",
  "dia",
  "dias",
  "fecha",
  "el",
  "la",
  "los",
  "las",
  "para",
  "en",
  "de",
  "del",
]);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" de hoy según el reloj del teléfono (hora local CR). */
export function hoyISOLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "2026-08-03" → "3 ago" para mostrar la fecha detectada. */
export function fmtFechaCortaISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
  });
}

/** Suma días a una fecha ISO sin pasar por zonas horarias. */
function sumarDiasISO(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/**
 * Quita tildes y signos de pregunta para comparar sin sustos. Se usa
 * en los DOS lados de la búsqueda: lo que escribió la persona y el
 * texto de cada negocio — así "san jose" encuentra "San José".
 */
export function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, " ");
}

/** Arma el ISO validando que el día exista en ese mes (no hay 31/02). */
function fechaValida(anio: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  const iso = d.toISOString().slice(0, 10);
  return iso === `${anio}-${pad2(mes)}-${pad2(dia)}` ? iso : null;
}

/**
 * "3 de agosto" sin año se asume la PRÓXIMA vez que caiga esa fecha:
 * si ya pasó este año, es la del año que viene.
 */
function proximaOcurrencia(hoyISO: string, mes: number, dia: number): string | null {
  const anio = Number(hoyISO.slice(0, 4));
  const esteAnio = fechaValida(anio, mes, dia);
  if (esteAnio && esteAnio >= hoyISO) return esteAnio;
  return fechaValida(anio + 1, mes, dia);
}

function proximoDiaSemana(hoyISO: string, dow: number): string {
  const hoyDow = new Date(hoyISO + "T00:00:00Z").getUTCDay();
  // "viernes" dicho un viernes = hoy mismo; si no, el que viene.
  const delta = (dow - hoyDow + 7) % 7;
  return sumarDiasISO(hoyISO, delta);
}

export function interpretarBusqueda(consulta: string, hoyISO: string): BusquedaInterpretada {
  let q = normalizarTexto(consulta);
  let fecha: string | null = null;

  // 1. "3 de agosto", "3 agosto", "3 de agosto de 2026"
  const nombreMes = q.match(
    /\b(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s*(?:de[l]?\s*)?(\d{4}))?\b/,
  );
  if (nombreMes) {
    const dia = Number(nombreMes[1]);
    const mes = MESES[nombreMes[2]];
    const anio = nombreMes[3] ? Number(nombreMes[3]) : null;
    fecha = anio ? fechaValida(anio, mes, dia) : proximaOcurrencia(hoyISO, mes, dia);
    if (fecha) q = q.replace(nombreMes[0], " ");
  }

  // 2. "3/8", "03-08", "3/8/2026" (día/mes, como se escribe acá)
  if (!fecha) {
    const numerica = q.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (numerica) {
      const dia = Number(numerica[1]);
      const mes = Number(numerica[2]);
      const anioCrudo = numerica[3] ? Number(numerica[3]) : null;
      const anio = anioCrudo === null ? null : anioCrudo < 100 ? 2000 + anioCrudo : anioCrudo;
      fecha = anio ? fechaValida(anio, mes, dia) : proximaOcurrencia(hoyISO, mes, dia);
      if (fecha) q = q.replace(numerica[0], " ");
    }
  }

  // 3. "hoy", "mañana", "pasado mañana"
  if (!fecha) {
    const relativa = q.match(/\b(pasado\s+manana|manana|hoy)\b/);
    if (relativa) {
      fecha =
        relativa[1] === "hoy"
          ? hoyISO
          : sumarDiasISO(hoyISO, relativa[1] === "manana" ? 1 : 2);
      q = q.replace(relativa[0], " ");
    }
  }

  // 4. "este viernes", "el sabado", "domingo" — y "el finde"
  if (!fecha) {
    const semana = q.match(
      /\b(?:este\s+|el\s+|proximo\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/,
    );
    if (semana) {
      fecha = proximoDiaSemana(hoyISO, DIAS_SEMANA[semana[1]]);
      q = q.replace(semana[0], " ");
    } else {
      const finde = q.match(/\b(?:este\s+|el\s+)?(?:fin\s+de\s+semana|finde)\b/);
      if (finde) {
        fecha = proximoDiaSemana(hoyISO, 6); // el sábado que viene
        q = q.replace(finde[0], " ");
      }
    }
  }

  // Con fecha detectada, se limpia la paja de la pregunta ("qué hay
  // libre ese día") para que no filtre como texto.
  let texto = q.replace(/\s+/g, " ").trim();
  if (fecha) {
    texto = texto
      .split(" ")
      .filter((palabra) => palabra && !RELLENO_FECHA.has(palabra))
      .join(" ");
  }

  return { texto, fecha };
}
