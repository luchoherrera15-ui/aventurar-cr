/**
 * BOOKEA — el catálogo de países, en un solo lugar.
 *
 * Bookea nació 100% costarricense: la provincia del negocio vivía en una
 * lista de 7 nombres (`PROVINCIAS` en src/app/mi-negocio/types.tsx) y en
 * un CHECK de la base (0008_marketplace_fase1.sql) que literalmente no
 * deja guardar un negocio de Panamá. Este archivo es el primer paso para
 * que el PAÍS sea un dato de primera clase y no un supuesto escondido.
 *
 * QUÉ ES ESTO Y QUÉ NO ES
 * - SÍ: la tabla de verdades por país (nombre, moneda, prefijo, cómo se
 *   llama su división de primer nivel y cuáles son).
 * - NO: el ruteo por país (/cr, /pa) ni el formateo de plata por moneda.
 *   Esas son fases posteriores; acá solo se deja el dato listo.
 *
 * REGLA QUE NO SE NEGOCIA: Costa Rica es el caso por defecto. Todo lo que
 * existe hoy es de Costa Rica, no tiene columna `pais` y tiene que seguir
 * funcionando exactamente igual — por eso `paisDe()` NUNCA devuelve null:
 * un dato ausente, viejo o corrupto cae en Costa Rica, que es el
 * comportamiento que la plataforma tuvo siempre.
 *
 * POR QUÉ TAN POCOS PAÍSES: un catálogo con 20 países a medias (regiones
 * inventadas, monedas aproximadas) es peor que uno corto y correcto —
 * los datos malos se copian a la base de producción y después hay que
 * limpiarlos a mano. Se agregan de a uno, cuando se abre el mercado.
 *
 * Módulo puro: sin red, sin base, sin `process.env`, sin JSX. Se puede
 * importar tanto desde un componente de cliente como desde una server
 * action (ver la nota de la frontera "use client" ↔ servidor).
 */

/** Cómo se llama la división de primer nivel en ese país. */
type EtiquetaRegion = {
  /** "Provincia", "Estado", "Departamento" — para labels de formulario. */
  singular: string;
  /** "Provincias", "Estados", "Departamentos" — para títulos y filtros. */
  plural: string;
};

/**
 * La moneda del país. ESTÁ DECLARADA PERO TODAVÍA NO SE USA: hoy los 127
 * archivos que muestran plata escriben ₡ y formatean con "es-CR" a mano.
 * Migrarlos es una fase aparte; cuando llegue, va a leer de acá en vez de
 * tener el colón cableado. No cablear nada nuevo al colón mientras tanto.
 */
type MonedaPais = {
  /** Código ISO 4217 en mayúscula: "CRC", "USD", "MXN", "COP". */
  codigo: string;
  /** El símbolo como lo escribe la gente de ese país: "₡", "$". */
  simbolo: string;
};

export type Pais = {
  /** ISO 3166-1 alfa-2, SIEMPRE en minúscula: es lo que va a la URL (/cr). */
  codigo: string;
  /** Nombre en español, como se muestra en un selector. */
  nombre: string;
  /** Gentilicio en singular masculino: "costarricense", "panameño". */
  gentilicio: string;
  /** Bandera en emoji, para que el selector de país se lea de un vistazo. */
  bandera: string;
  moneda: MonedaPais;
  /**
   * Locale BCP 47 para `toLocaleString`. Va junto al país y no junto a la
   * moneda porque el separador de miles es del país, no del billete.
   * Igual que `moneda`: declarado, todavía sin usar.
   */
  locale: string;
  /** Prefijo telefónico internacional CON el "+": "+506". */
  prefijoTelefono: string;
  /**
   * Zonas horarias IANA del país; la PRIMERA es la que se asigna por
   * defecto al dar de alta un negocio (`ranchos.zona_horaria`, 0062).
   *
   * Vive acá y no en un archivo aparte porque ya vivía aparte —en
   * `src/lib/zonas.ts`— y eso dejó DOS catálogos de países que se iban a
   * separar: uno con las zonas y otro con las monedas y las regiones,
   * uno con los códigos en mayúscula y el otro en minúscula. De esto
   * dependen la disponibilidad, los recordatorios y los calendarios, así
   * que no puede quedar en la lista que alguien olvide actualizar.
   *
   * Los países con varias zonas (México) necesitan elegirla por región
   * al darse de alta; el arreglo ya lo permite.
   */
  zonas: readonly [string, ...string[]];
  /** Cómo llamar a la división de primer nivel en la UI de ese país. */
  region: EtiquetaRegion;
  /**
   * Las divisiones de primer nivel, con el nombre EXACTO (tildes
   * incluidas) que se guarda en la columna `provincia` de `ranchos`.
   * Son strings y no objetos con id a propósito: la base guarda el
   * nombre visible desde el día uno y cambiar eso rompería los datos
   * existentes sin ganar nada.
   */
  regiones: readonly string[];
};

/**
 * EL CATÁLOGO.
 *
 * Por qué estos cuatro y no otros:
 * - cr: es el mercado actual. Sus 7 provincias son copia literal de
 *   `PROVINCIAS` (src/app/mi-negocio/types.tsx) — mismo orden, mismas
 *   tildes — porque son las que ya están guardadas en producción y las
 *   que acepta el CHECK de la base. Si alguna cambia acá, se rompen los
 *   negocios vivos: por eso hay un test que las fija.
 * - pa: el próximo mercado. Frontera con Costa Rica, mismo idioma, misma
 *   escala de negocio y dolarizado (un problema menos de moneda).
 * - mx y co: los dos mercados hispanohablantes grandes de la región.
 *   Están completos para poder probar de verdad el caso "el país no usa
 *   la palabra provincia" — que es lo único que la UI todavía no sabía
 *   manejar.
 */
export const PAISES = [
  {
    codigo: "cr",
    nombre: "Costa Rica",
    gentilicio: "costarricense",
    bandera: "🇨🇷",
    moneda: { codigo: "CRC", simbolo: "₡" },
    locale: "es-CR",
    prefijoTelefono: "+506",
    zonas: ["America/Costa_Rica"] as const,
    region: { singular: "Provincia", plural: "Provincias" },
    // ⚠️ Copia literal de PROVINCIAS. No reordenar ni "corregir" tildes.
    regiones: [
      "San José",
      "Alajuela",
      "Cartago",
      "Heredia",
      "Guanacaste",
      "Puntarenas",
      "Limón",
    ],
  },
  {
    codigo: "pa",
    nombre: "Panamá",
    gentilicio: "panameño",
    bandera: "🇵🇦",
    // Panamá tiene el balboa (PAB) a la par del dólar, pero solo existe
    // en monedas: los billetes que circulan son dólares y los precios se
    // publican en dólares. Se declara USD porque es lo que el cliente ve
    // y lo que un cobro real mueve, no el código de la unidad contable.
    moneda: { codigo: "USD", simbolo: "$" },
    locale: "es-PA",
    prefijoTelefono: "+507",
    zonas: ["America/Panama"] as const,
    region: { singular: "Provincia", plural: "Provincias" },
    // Las 10 provincias más las 3 comarcas indígenas de nivel provincial.
    // Las comarcas van en la misma lista porque para un negocio son una
    // ubicación como cualquier otra: separarlas solo complicaría el
    // <select> sin que nadie gane nada.
    regiones: [
      "Bocas del Toro",
      "Coclé",
      "Colón",
      "Chiriquí",
      "Darién",
      "Herrera",
      "Los Santos",
      "Panamá",
      "Panamá Oeste",
      "Veraguas",
      "Guna Yala",
      "Emberá-Wounaan",
      "Ngäbe-Buglé",
    ],
  },
  {
    codigo: "mx",
    nombre: "México",
    gentilicio: "mexicano",
    bandera: "🇲🇽",
    moneda: { codigo: "MXN", simbolo: "$" },
    locale: "es-MX",
    prefijoTelefono: "+52",
    // México tiene varias: la primera es la default, y el alta debería
    // dejar elegir por región cuando ese mercado se abra de verdad.
    zonas: ["America/Mexico_City", "America/Cancun", "America/Tijuana"] as const,
    region: { singular: "Estado", plural: "Estados" },
    // Las 32 entidades federativas, en orden alfabético.
    regiones: [
      "Aguascalientes",
      "Baja California",
      "Baja California Sur",
      "Campeche",
      "Chiapas",
      "Chihuahua",
      "Ciudad de México",
      "Coahuila",
      "Colima",
      "Durango",
      "Estado de México",
      "Guanajuato",
      "Guerrero",
      "Hidalgo",
      "Jalisco",
      "Michoacán",
      "Morelos",
      "Nayarit",
      "Nuevo León",
      "Oaxaca",
      "Puebla",
      "Querétaro",
      "Quintana Roo",
      "San Luis Potosí",
      "Sinaloa",
      "Sonora",
      "Tabasco",
      "Tamaulipas",
      "Tlaxcala",
      "Veracruz",
      "Yucatán",
      "Zacatecas",
    ],
  },
  {
    codigo: "co",
    nombre: "Colombia",
    gentilicio: "colombiano",
    bandera: "🇨🇴",
    moneda: { codigo: "COP", simbolo: "$" },
    locale: "es-CO",
    prefijoTelefono: "+57",
    zonas: ["America/Bogota"] as const,
    region: { singular: "Departamento", plural: "Departamentos" },
    // Los 32 departamentos más Bogotá D.C., que no es departamento pero
    // es el primer nivel donde vive el negocio y sin ella la capital no
    // se podría elegir.
    regiones: [
      "Amazonas",
      "Antioquia",
      "Arauca",
      "Atlántico",
      "Bogotá D.C.",
      "Bolívar",
      "Boyacá",
      "Caldas",
      "Caquetá",
      "Casanare",
      "Cauca",
      "Cesar",
      "Chocó",
      "Córdoba",
      "Cundinamarca",
      "Guainía",
      "Guaviare",
      "Huila",
      "La Guajira",
      "Magdalena",
      "Meta",
      "Nariño",
      "Norte de Santander",
      "Putumayo",
      "Quindío",
      "Risaralda",
      "San Andrés y Providencia",
      "Santander",
      "Sucre",
      "Tolima",
      "Valle del Cauca",
      "Vaupés",
      "Vichada",
    ],
  },
  {
    codigo: "ni",
    nombre: "Nicaragua",
    gentilicio: "nicaragüense",
    bandera: "🇳🇮",
    moneda: { codigo: "NIO", simbolo: "C$" },
    locale: "es-NI",
    prefijoTelefono: "+505",
    zonas: ["America/Managua"] as const,
    region: { singular: "Departamento", plural: "Departamentos" },
    // 15 departamentos y las 2 regiones autónomas de la Costa Caribe,
    // que son del mismo nivel administrativo: van en la misma lista
    // porque para un negocio son una ubicación como cualquier otra.
    regiones: [
      "Boaco",
      "Carazo",
      "Chinandega",
      "Chontales",
      "Costa Caribe Norte",
      "Costa Caribe Sur",
      "Estelí",
      "Granada",
      "Jinotega",
      "León",
      "Madriz",
      "Managua",
      "Masaya",
      "Matagalpa",
      "Nueva Segovia",
      "Río San Juan",
      "Rivas",
    ],
  },
  {
    codigo: "gt",
    nombre: "Guatemala",
    gentilicio: "guatemalteco",
    bandera: "🇬🇹",
    moneda: { codigo: "GTQ", simbolo: "Q" },
    locale: "es-GT",
    prefijoTelefono: "+502",
    zonas: ["America/Guatemala"] as const,
    region: { singular: "Departamento", plural: "Departamentos" },
    // Los 22 departamentos.
    regiones: [
      "Alta Verapaz",
      "Baja Verapaz",
      "Chimaltenango",
      "Chiquimula",
      "El Progreso",
      "Escuintla",
      "Guatemala",
      "Huehuetenango",
      "Izabal",
      "Jalapa",
      "Jutiapa",
      "Petén",
      "Quetzaltenango",
      "Quiché",
      "Retalhuleu",
      "Sacatepéquez",
      "San Marcos",
      "Santa Rosa",
      "Sololá",
      "Suchitepéquez",
      "Totonicapán",
      "Zacapa",
    ],
  },
  {
    codigo: "sv",
    nombre: "El Salvador",
    gentilicio: "salvadoreño",
    bandera: "🇸🇻",
    // Dolarizado desde 2001: el colón salvadoreño dejó de circular. Se
    // declara USD porque es lo que la gente ve en un precio.
    moneda: { codigo: "USD", simbolo: "$" },
    locale: "es-SV",
    prefijoTelefono: "+503",
    zonas: ["America/El_Salvador"] as const,
    region: { singular: "Departamento", plural: "Departamentos" },
    // Los 14 departamentos.
    regiones: [
      "Ahuachapán",
      "Cabañas",
      "Chalatenango",
      "Cuscatlán",
      "La Libertad",
      "La Paz",
      "La Unión",
      "Morazán",
      "San Miguel",
      "San Salvador",
      "San Vicente",
      "Santa Ana",
      "Sonsonate",
      "Usulután",
    ],
  },
  {
    codigo: "hn",
    nombre: "Honduras",
    gentilicio: "hondureño",
    bandera: "🇭🇳",
    moneda: { codigo: "HNL", simbolo: "L" },
    locale: "es-HN",
    prefijoTelefono: "+504",
    zonas: ["America/Tegucigalpa"] as const,
    region: { singular: "Departamento", plural: "Departamentos" },
    // Los 18 departamentos.
    regiones: [
      "Atlántida",
      "Choluteca",
      "Colón",
      "Comayagua",
      "Copán",
      "Cortés",
      "El Paraíso",
      "Francisco Morazán",
      "Gracias a Dios",
      "Intibucá",
      "Islas de la Bahía",
      "La Paz",
      "Lempira",
      "Ocotepeque",
      "Olancho",
      "Santa Bárbara",
      "Valle",
      "Yoro",
    ],
  },
] as const satisfies readonly Pais[];

/** Los códigos salen del catálogo, no se repiten a mano. */
export type CodigoPais = (typeof PAISES)[number]["codigo"];

/**
 * Costa Rica ya resuelta, y —esto es lo importante— CON SU TIPO
 * LITERAL INTACTO: `COSTA_RICA.regiones` no es `readonly string[]` sino
 * la tupla `readonly ["San José", … , "Limón"]`.
 *
 * Existe para que `PROVINCIAS` (src/app/mi-negocio/types.tsx) pueda
 * DERIVARSE de acá sin perder el tipo `Provincia`, que es una unión de
 * esos 7 literales y de la que cuelga `CANTONES` y media docena de
 * formularios. Con `regionesDe("cr")` —que devuelve `readonly string[]`
 * porque tiene que servir a cualquier país— `Provincia` se habría
 * ensanchado a `string` y el compilador habría dejado de atajar un
 * "San Jose" sin tilde.
 *
 * La anotación `Extract<…, { codigo: "cr" }>` no es decoración: es el
 * seguro. `PAISES[0]` es una posición, y el día que alguien reordene el
 * catálogo o meta un país arriba, esta línea deja de compilar en vez de
 * dejar las "provincias de Costa Rica" apuntando a otro país.
 */
export const COSTA_RICA: Extract<(typeof PAISES)[number], { codigo: "cr" }> =
  PAISES[0];

/** Los códigos sueltos, para iterar o validar sin recorrer el catálogo. */
export const CODIGOS_PAIS: readonly CodigoPais[] = PAISES.map((p) => p.codigo);

/**
 * Costa Rica. Todo lo que ya está guardado (negocios, reservas, búsquedas)
 * es de acá y no tiene el dato: cuando falta, es este.
 */
export const PAIS_POR_DEFECTO: CodigoPais = "cr";

/** Índice por código, para no recorrer el arreglo en cada llamada. */
const POR_CODIGO = new Map<string, Pais>(PAISES.map((p) => [p.codigo, p]));

/** El objeto de Costa Rica ya resuelto: es el fallback de `paisDe`. */
const POR_DEFECTO: Pais = POR_CODIGO.get(PAIS_POR_DEFECTO) ?? PAISES[0];

/**
 * ¿Este valor es un código de país que Bookea conoce?
 *
 * Es un type guard para poder angostar un `string` de la base o de la URL
 * a `CodigoPais` sin castear a ciegas. Estricto a propósito: "CR" en
 * mayúscula NO pasa — el código canónico es minúscula (es lo que va a la
 * URL) y aceptar las dos formas terminaría con las dos guardadas en la
 * base. Para normalizar entrada sucia está `paisDe`.
 */
export function esPais(valor: unknown): valor is CodigoPais {
  return typeof valor === "string" && POR_CODIGO.has(valor);
}

/**
 * El país de un código. SIEMPRE devuelve algo.
 *
 * Cae en Costa Rica ante null, undefined, un país que todavía no se abrió
 * o basura: una publicación vieja sin `pais` tiene que seguir mostrándose
 * igual que siempre, no reventar la página. Tolera espacios y mayúsculas
 * porque el dato puede venir de un query param escrito a mano ("/CR").
 */
export function paisDe(codigo: string | null | undefined): Pais {
  const limpio = typeof codigo === "string" ? codigo.trim().toLowerCase() : "";
  return POR_CODIGO.get(limpio) ?? POR_DEFECTO;
}

/**
 * El CÓDIGO del país de un valor cualquiera, ya angostado a
 * `CodigoPais`. Es `paisDe(...).codigo` pero devolviendo el tipo
 * estrecho, para poder comparar contra el país elegido en la URL sin
 * castear en cada directorio.
 *
 * ⚠️ ES EL PUNTO DE ENTRADA DE LAS FILAS DE LA BASE, y por eso importa
 * que nunca falle: mientras la migración 0170 no esté pegada, las filas
 * de `ranchos` pueden llegar SIN `pais` (undefined) o con `'CR'` en
 * mayúscula, que es como lo guardó el alta desde la 0062. Las tres
 * formas —ausente, "CR" y "cr"— tienen que dar exactamente lo mismo, o
 * el directorio se vacía de golpe en producción.
 */
export function codigoPaisDe(valor: string | null | undefined): CodigoPais {
  const codigo = paisDe(valor).codigo;
  return esPais(codigo) ? codigo : PAIS_POR_DEFECTO;
}

/** Las regiones de primer nivel de un país (las 7 provincias en CR). */
export function regionesDe(codigo: string | null | undefined): readonly string[] {
  return paisDe(codigo).regiones;
}

/**
 * Cómo llamar a la región en la UI: "Provincia" en Costa Rica y Panamá,
 * "Estado" en México, "Departamento" en Colombia. Sirve para que el label
 * del formulario deje de decir "Provincia" en un país que no tiene.
 */
export function etiquetaRegion(codigo: string | null | undefined): string {
  return paisDe(codigo).region.singular;
}

/** La misma etiqueta en plural, para títulos y filtros ("Estados"). */
export function etiquetaRegionPlural(codigo: string | null | undefined): string {
  return paisDe(codigo).region.plural;
}

/**
 * ¿Esa región pertenece a ese país? Para validar en el server action lo
 * que mandó el formulario antes de guardarlo — el reemplazo en código del
 * CHECK de la base, que hasta hoy solo conocía las 7 de Costa Rica.
 *
 * Compara exacto (tildes incluidas) porque es exactamente lo que se
 * guarda: aceptar "Limon" sin tilde metería dos escrituras distintas de
 * la misma provincia en la columna y rompería los filtros por zona.
 */
export function esRegionDe(
  codigo: string | null | undefined,
  region: string | null | undefined,
): boolean {
  if (typeof region !== "string") return false;
  return paisDe(codigo).regiones.includes(region);
}
