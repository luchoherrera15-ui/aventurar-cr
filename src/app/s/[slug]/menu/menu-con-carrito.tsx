"use client";

import { useMemo, useState, useTransition } from "react";
import { IconWhatsapp } from "@/components/icons";
import { fmtMoneda, PAIS, type Moneda, type Pais } from "@/lib/monedas";
import type { RotulosCatalogo } from "@/lib/solutions/rubros";
import { enlaceDeWhatsapp, textoConsulta } from "@/lib/solutions/whatsapp";
import { conVariante } from "@/lib/solutions/fotos";
import { ALERGENO, IDIOMA, type Alergeno, type Idioma, type IdiomaExtra, type Nutricion } from "@/lib/solutions/idiomas";
import { TOPES, type MetodoPago } from "@/lib/solutions/tipos";
import { pedirDesdeLaMesa, pedirParaLlevar } from "./pedir-actions";
import {
  detalleDeLinea,
  firmaDeLinea,
  precioDeLinea,
  seArma,
  SIN_ELECCION,
  TOPES_PERSONALIZACION,
  type Eleccion,
  type Personalizacion,
} from "@/lib/solutions/personalizacion";
import { textoDelPedido } from "@/lib/solutions/whatsapp";
import { ESTILO_MENU, ESTILO_MENU_BASE, type DefEstiloMenu } from "@/lib/solutions/menu-estilos";
import { pintaDeEstilo } from "@/lib/solutions/menu-pinta";
import { AIRE_SECCION, ListaPlatos, PlatoEnEstilo, TituloSeccion } from "./plato-en-estilo";

type Item = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number | null;
  foto_url: string | null;
  nutricion: Nutricion | null;
  /** Qué se le puede quitar y qué se le puede agregar (0241). */
  personalizacion: Personalizacion;
};

/**
 * UN RENGLÓN DEL CARRITO.
 *
 * No es «el plato X, tres veces»: es «el plato X, ASÍ, tres veces». Dos
 * hamburguesas iguales comparten renglón (misma `firma`); una sin
 * cebolla y otra con queso son dos renglones, porque a la cocina le
 * llegan como dos cosas distintas.
 */
type Linea = { firma: string; itemId: string; cantidad: number; eleccion: Eleccion };
type Grupo = { nombre: string; items: Item[] };
type Paleta = {
  fondo: string;
  acento: string;
  tinta: string;
  suave: string;
  superficie: string;
  borde: string;
  tintaSobreAcento: string;
};

/**
 * EL MENÚ CON CARRITO — en el idioma del cliente, con ficha por plato.
 *
 * Solo lectura si no se puede pedir. Cada plato con precio suma al
 * carrito; los «a consultar» no se pueden pedir (no hay monto que
 * congelar). El carrito vive abajo, fijo, y se abre en una hoja antes
 * de enviar.
 *
 * ── LOS IDIOMAS (0235) ──────────────────────────────────────────────
 * Los nombres y descripciones ya vienen traducidos del servidor
 * (`textoEn`); acá solo se traducen los rótulos de la interfaz
 * («Ver pedido», «Total», la ficha…) con el diccionario `T`. Cambiar
 * de idioma es un enlace con `?idioma=`: así el menú en inglés se
 * puede compartir como tal, y la mesa viaja en la URL igual.
 *
 * ── LA FICHA DEL PLATO ──────────────────────────────────────────────
 * Tocar la foto o el nombre abre el detalle: la foto grande, la
 * descripción entera y —si el negocio la cargó— la ficha nutricional
 * y los alérgenos. Pedido del dueño (5 sep 2026): «al clickear la
 * foto, ver cuánta proteína, cuánto tal cosa; opcional».
 *
 * ── DESDE LA MESA / TO GO / EXPRÉS ──────────────────────────────────
 * Con número de mesa (viene en el QR), el pedido va a la cocina. Sin
 * mesa y con To go o Exprés prendidos, la hoja pide los datos del
 * cliente y el pedido cae en el Modo restaurante, marcado.
 */

type Rotulos = {
  verPedido: string;
  total: string;
  enviar: string;
  enviando: string;
  consultar: string;
  cerrar: string;
  pedirMas: string;
  tuPedido: string;
  mesa: string;
  agregar: string;
  quitar: string;
  envio: string;
  envioGratis: string;
  comoLoQueres: string;
  llevar: string;
  llevarPie: string;
  express: string;
  nombre: string;
  nombreOpcional: string;
  telefono: string;
  cedula: string;
  direccion: string;
  comoPagas: string;
  nota: string;
  pieMesa: string;
  pieLlevar: string;
  enviadoMesa: string;
  enviadoMesaPie: string;
  recibido: string;
  pagas: string;
  teLlevamos: string;
  pasaARecoger: string;
  teAvisamos: string;
  guardaCodigo: string;
  secciones: string;
  idioma: string;
  porcion: string;
  calorias: string;
  proteina: string;
  carbohidratos: string;
  grasa: string;
  alergenos: string;
  contiene: string;
  metodos: Record<MetodoPago, string>;
  alergeno: Record<Alergeno, string>;
};

const T: Record<Idioma, Rotulos> = {
  es: {
    verPedido: "Ver pedido", total: "Total", enviar: "Enviar pedido", enviando: "Enviando…", consultar: "Consultar", cerrar: "Cerrar",
    pedirMas: "Pedir algo más", tuPedido: "Tu pedido", mesa: "Mesa", agregar: "Agregar", quitar: "quitar", envio: "Envío", envioGratis: "Envío gratis",
    comoLoQueres: "¿Cómo lo querés?", llevar: "To go", llevarPie: "Pasás a recogerlo", express: "Exprés",
    nombre: "Tu nombre", nombreOpcional: "Tu nombre (opcional)", telefono: "Tu teléfono (te avisamos ahí)", cedula: "Cédula (opcional, para la factura)",
    direccion: "Dirección exacta para el envío", comoPagas: "¿Cómo pagás?", nota: "Algo que debamos saber (sin cebolla, alergias…)",
    pieMesa: "El pago es en el local. Esto solo avisa a la cocina.", pieLlevar: "El negocio recibe tu pedido al instante y te avisa al teléfono cuando esté listo.",
    enviadoMesa: "Pedido enviado a la mesa", enviadoMesaPie: "Te lo llevan a la mesa; el pago es en el local.",
    recibido: "Pedido recibido", pagas: "pagás con", teLlevamos: "Te lo llevamos a", pasaARecoger: "Pasá a recogerlo cuando te avisemos.",
    teAvisamos: "Te avisamos al", guardaCodigo: "Guardá el código por si te lo piden.", secciones: "Secciones del menú", idioma: "Idioma",
    porcion: "Porción", calorias: "Calorías", proteina: "Proteína", carbohidratos: "Carbohidratos", grasa: "Grasa", alergenos: "Alérgenos", contiene: "Contiene",
    metodos: { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" },
    alergeno: ALERGENO,
  },
  en: {
    verPedido: "View order", total: "Total", enviar: "Place order", enviando: "Sending…", consultar: "Ask", cerrar: "Close",
    pedirMas: "Order something else", tuPedido: "Your order", mesa: "Table", agregar: "Add", quitar: "remove", envio: "Delivery", envioGratis: "Free delivery",
    comoLoQueres: "How would you like it?", llevar: "To go", llevarPie: "Pick it up", express: "Delivery",
    nombre: "Your name", nombreOpcional: "Your name (optional)", telefono: "Your phone (we'll text you there)", cedula: "ID number (optional, for the invoice)",
    direccion: "Exact delivery address", comoPagas: "How will you pay?", nota: "Anything we should know (no onion, allergies…)",
    pieMesa: "You pay at the restaurant. This only notifies the kitchen.", pieLlevar: "The restaurant gets your order instantly and lets you know when it's ready.",
    enviadoMesa: "Order sent to table", enviadoMesaPie: "It will be brought to your table; you pay at the restaurant.",
    recibido: "Order received", pagas: "paying by", teLlevamos: "We'll deliver to", pasaARecoger: "Pick it up when we let you know.",
    teAvisamos: "We'll notify", guardaCodigo: "Keep the code in case they ask.", secciones: "Menu sections", idioma: "Language",
    porcion: "Serving", calorias: "Calories", proteina: "Protein", carbohidratos: "Carbs", grasa: "Fat", alergenos: "Allergens", contiene: "Contains",
    metodos: { efectivo: "Cash", tarjeta: "Card", transferencia: "Bank transfer" },
    alergeno: { gluten: "Gluten", lacteos: "Dairy", huevo: "Egg", mani: "Peanuts", frutos_secos: "Tree nuts", soya: "Soy", mariscos: "Shellfish", pescado: "Fish", sesamo: "Sesame" },
  },
  fr: {
    verPedido: "Voir la commande", total: "Total", enviar: "Commander", enviando: "Envoi…", consultar: "Sur demande", cerrar: "Fermer",
    pedirMas: "Commander autre chose", tuPedido: "Votre commande", mesa: "Table", agregar: "Ajouter", quitar: "retirer", envio: "Livraison", envioGratis: "Livraison offerte",
    comoLoQueres: "Comment le souhaitez-vous ?", llevar: "À emporter", llevarPie: "Vous venez le chercher", express: "Livraison",
    nombre: "Votre nom", nombreOpcional: "Votre nom (facultatif)", telefono: "Votre téléphone (on vous prévient)", cedula: "Pièce d'identité (facultatif)",
    direccion: "Adresse exacte de livraison", comoPagas: "Comment payez-vous ?", nota: "Quelque chose à savoir (sans oignon, allergies…)",
    pieMesa: "Le paiement se fait sur place. Ceci prévient seulement la cuisine.", pieLlevar: "Le restaurant reçoit votre commande immédiatement et vous prévient quand elle est prête.",
    enviadoMesa: "Commande envoyée à la table", enviadoMesaPie: "On vous l'apporte à table ; le paiement se fait sur place.",
    recibido: "Commande reçue", pagas: "paiement en", teLlevamos: "Nous livrons à", pasaARecoger: "Venez la chercher quand on vous prévient.",
    teAvisamos: "On prévient le", guardaCodigo: "Gardez le code au cas où.", secciones: "Sections du menu", idioma: "Langue",
    porcion: "Portion", calorias: "Calories", proteina: "Protéines", carbohidratos: "Glucides", grasa: "Lipides", alergenos: "Allergènes", contiene: "Contient",
    metodos: { efectivo: "Espèces", tarjeta: "Carte", transferencia: "Virement" },
    alergeno: { gluten: "Gluten", lacteos: "Lait", huevo: "Œuf", mani: "Arachides", frutos_secos: "Fruits à coque", soya: "Soja", mariscos: "Crustacés", pescado: "Poisson", sesamo: "Sésame" },
  },
  it: {
    verPedido: "Vedi ordine", total: "Totale", enviar: "Invia ordine", enviando: "Invio…", consultar: "Su richiesta", cerrar: "Chiudi",
    pedirMas: "Ordina altro", tuPedido: "Il tuo ordine", mesa: "Tavolo", agregar: "Aggiungi", quitar: "togli", envio: "Consegna", envioGratis: "Consegna gratuita",
    comoLoQueres: "Come lo vuoi?", llevar: "Da asporto", llevarPie: "Passi a ritirarlo", express: "Consegna",
    nombre: "Il tuo nome", nombreOpcional: "Il tuo nome (facoltativo)", telefono: "Il tuo telefono (ti avvisiamo lì)", cedula: "Documento (facoltativo, per la fattura)",
    direccion: "Indirizzo esatto per la consegna", comoPagas: "Come paghi?", nota: "Qualcosa da sapere (senza cipolla, allergie…)",
    pieMesa: "Si paga al locale. Questo avvisa solo la cucina.", pieLlevar: "Il locale riceve subito il tuo ordine e ti avvisa quando è pronto.",
    enviadoMesa: "Ordine inviato al tavolo", enviadoMesaPie: "Te lo portano al tavolo; si paga al locale.",
    recibido: "Ordine ricevuto", pagas: "pagamento in", teLlevamos: "Consegniamo a", pasaARecoger: "Passa a ritirarlo quando ti avvisiamo.",
    teAvisamos: "Ti avvisiamo al", guardaCodigo: "Conserva il codice nel caso te lo chiedano.", secciones: "Sezioni del menù", idioma: "Lingua",
    porcion: "Porzione", calorias: "Calorie", proteina: "Proteine", carbohidratos: "Carboidrati", grasa: "Grassi", alergenos: "Allergeni", contiene: "Contiene",
    metodos: { efectivo: "Contanti", tarjeta: "Carta", transferencia: "Bonifico" },
    alergeno: { gluten: "Glutine", lacteos: "Latticini", huevo: "Uova", mani: "Arachidi", frutos_secos: "Frutta a guscio", soya: "Soia", mariscos: "Crostacei", pescado: "Pesce", sesamo: "Sesamo" },
  },
  pt: {
    verPedido: "Ver pedido", total: "Total", enviar: "Enviar pedido", enviando: "Enviando…", consultar: "Consultar", cerrar: "Fechar",
    pedirMas: "Pedir mais alguma coisa", tuPedido: "Seu pedido", mesa: "Mesa", agregar: "Adicionar", quitar: "tirar", envio: "Entrega", envioGratis: "Entrega grátis",
    comoLoQueres: "Como você prefere?", llevar: "Para viagem", llevarPie: "Você passa para buscar", express: "Entrega",
    nombre: "Seu nome", nombreOpcional: "Seu nome (opcional)", telefono: "Seu telefone (avisamos por lá)", cedula: "Documento (opcional, para a nota)",
    direccion: "Endereço exato para a entrega", comoPagas: "Como você paga?", nota: "Algo que devemos saber (sem cebola, alergias…)",
    pieMesa: "O pagamento é no local. Isto só avisa a cozinha.", pieLlevar: "O restaurante recebe seu pedido na hora e avisa quando estiver pronto.",
    enviadoMesa: "Pedido enviado para a mesa", enviadoMesaPie: "Levamos até a mesa; o pagamento é no local.",
    recibido: "Pedido recebido", pagas: "pagando com", teLlevamos: "Entregamos em", pasaARecoger: "Passe para buscar quando avisarmos.",
    teAvisamos: "Avisamos no", guardaCodigo: "Guarde o código caso peçam.", secciones: "Seções do menu", idioma: "Idioma",
    porcion: "Porção", calorias: "Calorias", proteina: "Proteína", carbohidratos: "Carboidratos", grasa: "Gordura", alergenos: "Alérgenos", contiene: "Contém",
    metodos: { efectivo: "Dinheiro", tarjeta: "Cartão", transferencia: "Transferência" },
    alergeno: { gluten: "Glúten", lacteos: "Laticínios", huevo: "Ovo", mani: "Amendoim", frutos_secos: "Castanhas", soya: "Soja", mariscos: "Frutos do mar", pescado: "Peixe", sesamo: "Gergelim" },
  },
  de: {
    verPedido: "Bestellung ansehen", total: "Gesamt", enviar: "Bestellen", enviando: "Wird gesendet…", consultar: "Auf Anfrage", cerrar: "Schließen",
    pedirMas: "Noch etwas bestellen", tuPedido: "Deine Bestellung", mesa: "Tisch", agregar: "Hinzufügen", quitar: "entfernen", envio: "Lieferung", envioGratis: "Kostenlose Lieferung",
    comoLoQueres: "Wie möchtest du es?", llevar: "Zum Mitnehmen", llevarPie: "Du holst es ab", express: "Lieferung",
    nombre: "Dein Name", nombreOpcional: "Dein Name (optional)", telefono: "Deine Telefonnummer (wir melden uns dort)", cedula: "Ausweisnummer (optional, für die Rechnung)",
    direccion: "Genaue Lieferadresse", comoPagas: "Wie bezahlst du?", nota: "Etwas, das wir wissen sollten (ohne Zwiebel, Allergien…)",
    pieMesa: "Bezahlt wird im Lokal. Das informiert nur die Küche.", pieLlevar: "Das Lokal erhält deine Bestellung sofort und meldet sich, wenn sie fertig ist.",
    enviadoMesa: "Bestellung an Tisch gesendet", enviadoMesaPie: "Sie wird an den Tisch gebracht; bezahlt wird im Lokal.",
    recibido: "Bestellung erhalten", pagas: "Zahlung per", teLlevamos: "Wir liefern an", pasaARecoger: "Hol sie ab, sobald wir uns melden.",
    teAvisamos: "Wir melden uns unter", guardaCodigo: "Bewahre den Code auf, falls danach gefragt wird.", secciones: "Menüabschnitte", idioma: "Sprache",
    porcion: "Portion", calorias: "Kalorien", proteina: "Eiweiß", carbohidratos: "Kohlenhydrate", grasa: "Fett", alergenos: "Allergene", contiene: "Enthält",
    metodos: { efectivo: "Bar", tarjeta: "Karte", transferencia: "Überweisung" },
    alergeno: { gluten: "Gluten", lacteos: "Milch", huevo: "Ei", mani: "Erdnüsse", frutos_secos: "Schalenfrüchte", soya: "Soja", mariscos: "Krebstiere", pescado: "Fisch", sesamo: "Sesam" },
  },
};

/**
 * Un botón de opción (modalidad, forma de pago) con la paleta del negocio.
 * En el MÓDULO, no adentro del componente (ver `Ancla` en vista-pagina.tsx).
 */
function Opcion({
  paleta,
  activo,
  onClick,
  children,
}: {
  paleta: Paleta;
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className="presionable min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-[13.5px] font-extrabold"
      style={{
        background: activo ? paleta.acento : paleta.superficie,
        color: activo ? paleta.tintaSobreAcento : paleta.tinta,
        borderColor: activo ? paleta.acento : paleta.borde,
      }}
    >
      {children}
    </button>
  );
}

export default function MenuConCarrito({
  negocioId,
  slug,
  mesa,
  puedePedir,
  grupos,
  paleta: paletaTema,
  estilo = ESTILO_MENU[ESTILO_MENU_BASE],
  idioma = "es",
  idiomas = [],
  llevar = false,
  express = false,
  costoExpress = 0,
  metodosPago = ["efectivo"],
  moneda = "CRC",
  pais = "CR",
  rotulos,
  negocioNombre = "",
  whatsapp = null,
  itemInicial = null,
}: {
  negocioId: string;
  slug: string;
  mesa: number | null;
  /** Desde la mesa: add-on + interruptor + número de mesa. */
  puedePedir: boolean;
  grupos: Grupo[];
  paleta: Paleta;
  /** El diseño del catálogo (menu-estilos.ts). Lo resuelve el servidor. */
  estilo?: DefEstiloMenu;
  /** El idioma en que ya vienen los textos, y los que se pueden elegir. */
  idioma?: Idioma;
  idiomas?: IdiomaExtra[];
  /** To go / exprés (0233). Los decide el servidor con el add-on y los interruptores. */
  llevar?: boolean;
  express?: boolean;
  costoExpress?: number;
  metodosPago?: MetodoPago[];
  /** La moneda de los precios y el país del WhatsApp (0236). */
  moneda?: Moneda;
  pais?: Pais;
  /** Los rótulos que cambian con el rubro: «To go» / «Recoger en tienda»… (0236). */
  rotulos?: RotulosCatalogo;
  negocioNombre?: string;
  /** El WhatsApp del negocio: si no vende en línea, cada ítem se consulta por ahí. */
  whatsapp?: string | null;
  /** `?item=`: abre la ficha de ese ítem al entrar (viene de la vitrina del link hub). */
  itemInicial?: string | null;
}) {
  // Los rótulos por rubro van POR ENCIMA del diccionario del idioma:
  // en una tienda «To go» es «Recoger en tienda» y «Enviar pedido» es
  // «Confirmar compra», en los seis idiomas.
  const t = { ...T[idioma], ...(rotulos ?? {}) };

  // EL DISEÑO DEL CATÁLOGO. Si trae papel propio (Bistró, Carbón,
  // Mármol…) gana sobre el tema del link hub; si no, se hereda. El
  // resto del archivo sigue leyendo `paleta`, que ahora es la del
  // diseño — así el carrito, la hoja y la ficha combinan solas.
  const pinta = pintaDeEstilo(estilo, {
    fondo: paletaTema.fondo,
    tinta: paletaTema.tinta,
    suave: paletaTema.suave,
    superficie: paletaTema.superficie,
    borde: paletaTema.borde,
    acento: paletaTema.acento,
    sobreAcento: paletaTema.tintaSobreAcento,
  });
  const paleta: Paleta = { ...pinta.paleta, tintaSobreAcento: pinta.paleta.sobreAcento };
  const $ = (n: number) => fmtMoneda(n, moneda);
  // El documento de identidad se llama distinto en cada país.
  const rotuloDocumento = pais === "CR" ? t.cedula : t.cedula.replace(/^[^(]+/, `${PAIS[pais].documento} `);
  const paraLlevar = mesa === null && (llevar || express);
  const puedeAgregar = puedePedir || paraLlevar;

  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<Item | null>(
    () => (itemInicial ? grupos.flatMap((g) => g.items).find((it) => it.id === itemInicial) ?? null : null),
  );
  const [nombre, setNombre] = useState("");
  const [nota, setNota] = useState("");
  const [modalidad, setModalidad] = useState<"llevar" | "express">(llevar ? "llevar" : "express");
  const [telefono, setTelefono] = useState("");
  const [cedula, setCedula] = useState("");
  const [direccion, setDireccion] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(metodosPago[0] ?? "efectivo");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<
    | { tipo: "mesa"; total: number; renglones: number }
    | { tipo: "llevar" | "express"; codigo: string; total: number; telefono: string; direccion: string; metodoPago: MetodoPago }
    | null
  >(null);
  const [enviando, arrancar] = useTransition();

  const porId = useMemo(() => new Map(grupos.flatMap((g) => g.items).map((it) => [it.id, it])), [grupos]);

  /** Lo que cuesta UNA unidad de ese renglón, ya con sus extras. */
  const precioDe = (l: Linea) => {
    const it = porId.get(l.itemId);
    return it ? precioDeLinea(it.precio ?? 0, it.personalizacion, l.eleccion) : 0;
  };
  const cantidadTotal = carrito.reduce((t, l) => t + l.cantidad, 0);
  const subtotal = carrito.reduce((t, l) => t + precioDe(l) * l.cantidad, 0);
  const envio = paraLlevar && modalidad === "express" ? costoExpress : 0;
  const total = subtotal + envio;

  /** Cuántas unidades de ESE plato hay en el carrito, en todos sus armados. */
  const enCarrito = (itemId: string) =>
    carrito.filter((l) => l.itemId === itemId).reduce((t, l) => t + l.cantidad, 0);

  const agregar = (it: Item, eleccion: Eleccion, cuantos = 1) => {
    const firma = firmaDeLinea(it.id, eleccion);
    setCarrito((prev) => {
      const i = prev.findIndex((l) => l.firma === firma);
      if (i === -1) {
        return [...prev, { firma, itemId: it.id, cantidad: Math.min(TOPES.cantidadPorRenglon, cuantos), eleccion }];
      }
      const copia = [...prev];
      copia[i] = { ...copia[i], cantidad: Math.min(TOPES.cantidadPorRenglon, copia[i].cantidad + cuantos) };
      return copia;
    });
  };

  const ajustarLinea = (firma: string, delta: number) =>
    setCarrito((prev) =>
      prev
        .map((l) =>
          l.firma === firma
            ? { ...l, cantidad: Math.max(0, Math.min(TOPES.cantidadPorRenglon, l.cantidad + delta)) }
            : l,
        )
        .filter((l) => l.cantidad > 0),
    );

  /** El renglón «simple» de un plato que no se arma. */
  const lineaSimple = (itemId: string) =>
    carrito.find((l) => l.firma === firmaDeLinea(itemId, SIN_ELECCION));

  /** Los renglones, ya en palabras, para el servidor y para WhatsApp. */
  const renglonesDetallados = carrito.map((l) => {
    const it = porId.get(l.itemId);
    return {
      nombre: it?.nombre ?? "",
      cantidad: l.cantidad,
      precio: precioDe(l),
      detalles: it ? detalleDeLinea(it.personalizacion, l.eleccion) : [],
    };
  });

  /**
   * Lo que el cliente pidió, en texto, para que NADA de lo que armó se
   * pierda por el camino del panel: `solutions_pedido_items` guarda
   * plato y cantidad, no «sin cebolla». Hasta que tenga su columna, el
   * detalle viaja en la nota del pedido — que es justo lo que la cocina
   * lee antes de armar el plato.
   */
  const notaConDetalle = () => {
    const partes = renglonesDetallados
      .filter((r) => r.detalles.length > 0)
      .map((r) => `${r.cantidad}× ${r.nombre}: ${r.detalles.join("; ")}`);
    return [nota.trim(), ...partes].filter(Boolean).join(" | ").slice(0, TOPES.pedidoNota);
  };

  const limpiar = () => {
    setCarrito([]);
    setNota("");
    setAbierto(false);
  };

  const enviarALaMesa = () => {
    if (!mesa) return;
    setError(null);
    arrancar(async () => {
      const r = await pedirDesdeLaMesa({ negocioId, slug, mesa, nombre, nota: notaConDetalle(), renglones: carrito.map((l) => ({ itemId: l.itemId, cantidad: l.cantidad, eleccion: l.eleccion })) });
      if (!r.ok) return setError(r.motivo);
      setEnviado({ tipo: "mesa", total: r.total, renglones: cantidadTotal });
      limpiar();
    });
  };

  const enviarParaLlevar = () => {
    setError(null);
    if (nombre.trim().length < 2) return setError(t.nombre + ".");
    if (telefono.replace(/\D/g, "").length < 8) return setError(t.telefono + ".");
    if (modalidad === "express" && direccion.trim().length < 5) return setError(t.direccion + ".");
    arrancar(async () => {
      const r = await pedirParaLlevar({ negocioId, slug, modalidad, nombre, telefono, cedula, direccion, metodoPago, nota: notaConDetalle(), renglones: carrito.map((l) => ({ itemId: l.itemId, cantidad: l.cantidad, eleccion: l.eleccion })) });
      if (!r.ok) return setError(r.motivo);
      // EL MENSAJE AUTOMÁTICO. El pedido ya quedó guardado (aparece en
      // el panel del negocio); esto abre WhatsApp con todo escrito —qué
      // pidió, cómo lo quiere, a nombre de quién, dónde y cuánto— para
      // que el local lo reciba por donde de verdad lo lee. Se arma con
      // el mismo `textoDelPedido` que usa el resto del producto.
      if (whatsapp) {
        const texto = textoDelPedido({
          negocio: negocioNombre,
          slug,
          codigo: r.codigo,
          modalidad,
          renglones: renglonesDetallados,
          costoEnvio: modalidad === "express" ? costoExpress : 0,
          total: r.total,
          moneda,
          cliente: {
            nombre: nombre.trim(),
            telefono: telefono.trim(),
            cedula: cedula.trim(),
            direccion: direccion.trim(),
            metodoPago: r.metodoPago,
            nota: nota.trim(),
          },
        });
        // `noopener`: la pestaña de WhatsApp no puede tocar esta página.
        window.open(enlaceDeWhatsapp(whatsapp, texto, pais), "_blank", "noopener,noreferrer");
      }
      setEnviado({ tipo: modalidad, codigo: r.codigo, total: r.total, telefono: telefono.trim(), direccion: direccion.trim(), metodoPago: r.metodoPago });
      limpiar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const seccionId = (n: string) => `seccion-${n.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const campo = "w-full rounded-xl border px-3.5 py-3 text-[15px] outline-none";
  const estiloCampo = { background: paleta.superficie, borderColor: paleta.borde, color: paleta.tinta };
  const hrefIdioma = (i: Idioma) => {
    const q = new URLSearchParams();
    if (i !== "es") q.set("idioma", i);
    if (mesa) q.set("mesa", String(mesa));
    const s = q.toString();
    return `/s/${slug}/menu${s ? `?${s}` : ""}`;
  };

  const filaNutricion = (n: Nutricion) =>
    (
      [
        ["porcion", t.porcion, n.porcion],
        ["calorias", t.calorias, n.calorias !== undefined ? `${n.calorias} kcal` : undefined],
        ["proteina", t.proteina, n.proteina !== undefined ? `${n.proteina} g` : undefined],
        ["carbohidratos", t.carbohidratos, n.carbohidratos !== undefined ? `${n.carbohidratos} g` : undefined],
        ["grasa", t.grasa, n.grasa !== undefined ? `${n.grasa} g` : undefined],
      ] as const
    ).filter((x) => x[2] !== undefined && x[2] !== "");

  return (
    <>
      {/* ── Confirmación ──────────────────────────────────────── */}
      {enviado && (
        <div className="mx-auto mt-4 w-full max-w-[var(--ancho-menu,520px)] px-5">
          <div className="rounded-2xl border p-4" style={{ background: paleta.superficie, borderColor: paleta.acento }}>
            {enviado.tipo === "mesa" ? (
              <>
                <p className="text-[15px] font-extrabold">✓ {t.enviadoMesa} {mesa}</p>
                <p className="mt-1 text-[13px]" style={{ color: paleta.suave }}>
                  {enviado.renglones} · {$(enviado.total)}. {t.enviadoMesaPie}
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-extrabold">
                  ✓ {t.recibido} #{enviado.codigo} · {enviado.tipo === "express" ? t.express : t.llevar}
                </p>
                <p className="mt-1 text-[13px]" style={{ color: paleta.suave }}>
                  {$(enviado.total)} · {t.pagas} {t.metodos[enviado.metodoPago].toLowerCase()}.{" "}
                  {enviado.tipo === "express" ? `${t.teLlevamos} ${enviado.direccion}.` : t.pasaARecoger} {t.teAvisamos}{" "}
                  {enviado.telefono}. {t.guardaCodigo}
                </p>
              </>
            )}
            <button type="button" onClick={() => setEnviado(null)} className="mt-2 block text-[12.5px] font-bold underline">
              {t.pedirMas}
            </button>
          </div>
        </div>
      )}

      {/* ── El idioma ─────────────────────────────────────────── */}
      {idiomas.length > 0 && (
        <nav aria-label={t.idioma} className="mx-auto mt-4 flex w-full max-w-[var(--ancho-menu,520px)] flex-wrap gap-1.5 px-5">
          {(["es", ...idiomas] as Idioma[]).map((i) => (
            <a
              key={i}
              href={hrefIdioma(i)}
              aria-current={i === idioma ? "true" : undefined}
              className="rounded-full border px-3 py-1.5 text-[12px] font-extrabold"
              style={{
                background: i === idioma ? paleta.acento : paleta.superficie,
                color: i === idioma ? paleta.tintaSobreAcento : paleta.tinta,
                borderColor: i === idioma ? paleta.acento : paleta.borde,
              }}
            >
              {IDIOMA[i].propio}
            </a>
          ))}
        </nav>
      )}

      {/* ── Anclas ─────────────────────────────────────────────── */}
      {grupos.length > 1 && (
        <nav aria-label={t.secciones} className="sticky top-0 z-10 mt-4 overflow-x-auto px-5 py-2.5" style={{ background: paleta.fondo }}>
          <ul className="mx-auto flex w-full max-w-[var(--ancho-menu,520px)] gap-2">
            {grupos.map((g) => (
              <li key={g.nombre} className="shrink-0">
                <a href={`#${seccionId(g.nombre)}`} className="block rounded-full px-3 py-1.5 text-[12.5px] font-bold" style={{ background: paleta.superficie, border: `1px solid ${paleta.borde}` }}>
                  {g.nombre}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ── El menú, en el diseño elegido ──────────────────────── */}
      <div className={`mx-auto flex w-full max-w-[var(--ancho-menu,520px)] flex-col ${AIRE_SECCION[pinta.def.aire]} px-5 pt-4`}>
        {grupos.map((g) => (
          <section key={g.nombre} id={seccionId(g.nombre)} className="scroll-mt-14">
            <TituloSeccion pinta={pinta} nombre={g.nombre} />
            <ListaPlatos pinta={pinta}>
              {g.items.map((it) => {
                const cant = enCarrito(it.id);
                const pedible = puedeAgregar && it.precio !== null;
                // El plato que se arma NO se suma de un toque: abre la
                // ficha, que es donde están sus casillas.
                const arma = seArma(it.personalizacion);
                return (
                  <PlatoEnEstilo
                    key={it.id}
                    pinta={pinta}
                    destacado={cant > 0}
                    alAbrir={() => setDetalle(it)}
                    plato={{
                      nombre: it.nombre,
                      descripcion: it.descripcion,
                      fotoUrl: it.foto_url,
                      precio: it.precio === null ? t.consultar : $(it.precio),
                      tieneNutricion: it.nutricion !== null,
                    }}
                    acciones={
                      <>
                        {!puedeAgregar && whatsapp && (
                          <a
                            href={enlaceDeWhatsapp(whatsapp, textoConsulta({ negocio: negocioNombre, item: it.nombre, precio: it.precio, moneda, slug }), pais)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${t.consultarWhatsapp}: ${it.nombre}`}
                            className="presionable grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                            style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
                          >
                            <IconWhatsapp className="h-5 w-5" />
                          </a>
                        )}
                        {pedible &&
                          (arma ? (
                            <button
                              type="button"
                              onClick={() => setDetalle(it)}
                              aria-label={`${A[idioma].armar} ${it.nombre}`}
                              className="presionable relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[20px] font-extrabold"
                              style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
                            >
                              +
                              {cant > 0 && (
                                <span
                                  className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-extrabold tabular-nums"
                                  style={{ background: paleta.tinta, color: paleta.fondo }}
                                >
                                  {cant}
                                </span>
                              )}
                            </button>
                          ) : cant === 0 ? (
                            <button type="button" onClick={() => agregar(it, SIN_ELECCION)} aria-label={`${t.agregar} ${it.nombre}`} className="presionable grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[20px] font-extrabold" style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}>
                              +
                            </button>
                          ) : (
                            <div className="flex shrink-0 items-center rounded-xl" style={{ border: `1px solid ${paleta.acento}` }}>
                              <button type="button" onClick={() => ajustarLinea(firmaDeLinea(it.id, SIN_ELECCION), -1)} aria-label={`${t.quitar} ${it.nombre}`} className="presionable h-10 w-9 text-[18px] font-extrabold">−</button>
                              <span className="w-6 text-center text-[14px] font-extrabold tabular-nums">{lineaSimple(it.id)?.cantidad ?? cant}</span>
                              <button type="button" onClick={() => ajustarLinea(firmaDeLinea(it.id, SIN_ELECCION), 1)} aria-label={`${t.agregar} ${it.nombre}`} className="presionable h-10 w-9 text-[18px] font-extrabold">+</button>
                            </div>
                          ))}
                      </>
                    }
                  />
                );
              })}
            </ListaPlatos>
          </section>
        ))}
      </div>

      {/* ── La ficha del plato ────────────────────────────────── */}
      {detalle && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" onClick={() => setDetalle(null)}>
          <div role="dialog" aria-modal="true" aria-label={detalle.nombre} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-[var(--ancho-menu,520px)] overflow-y-auto rounded-t-3xl sm:rounded-3xl" style={{ background: paleta.fondo, color: paleta.tinta, border: `1px solid ${paleta.borde}` }}>
            {detalle.foto_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={conVariante(detalle.foto_url, "gallery") ?? detalle.foto_url} alt="" className="aspect-[4/3] w-full object-cover" />
            )}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[20px] font-extrabold leading-tight">{detalle.nombre}</h2>
                <button type="button" onClick={() => setDetalle(null)} aria-label={t.cerrar} className="text-[24px] leading-none">×</button>
              </div>
              {detalle.descripcion && <p className="mt-2 text-[14px] leading-relaxed" style={{ color: paleta.suave }}>{detalle.descripcion}</p>}
              <p className="mt-3 text-[18px] font-extrabold tabular-nums" style={{ color: paleta.acento }}>
                {detalle.precio === null ? t.consultar : $(detalle.precio)}
              </p>

              {detalle.nutricion && (
                <div className="mt-4 rounded-2xl border p-3.5" style={{ background: paleta.superficie, borderColor: paleta.borde }}>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
                    {filaNutricion(detalle.nutricion).map(([k, rotulo, valor]) => (
                      <div key={k}>
                        <dt className="text-[10.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: paleta.suave }}>{rotulo}</dt>
                        <dd className="font-extrabold tabular-nums">{valor}</dd>
                      </div>
                    ))}
                  </dl>
                  {detalle.nutricion.alergenos && detalle.nutricion.alergenos.length > 0 && (
                    <p className="mt-3 text-[12.5px]">
                      <span className="font-extrabold">{t.contiene}:</span>{" "}
                      {detalle.nutricion.alergenos.map((a) => t.alergeno[a]).join(", ")}
                    </p>
                  )}
                </div>
              )}

              {puedeAgregar && detalle.precio !== null && (
                <Armar
                  key={detalle.id}
                  item={detalle}
                  paleta={paleta}
                  idioma={idioma}
                  precio={$}
                  onAgregar={(eleccion, cuantos) => {
                    agregar(detalle, eleccion, cuantos);
                    setDetalle(null);
                  }}
                />
              )}
              {!puedeAgregar && whatsapp && (
                <a
                  href={enlaceDeWhatsapp(whatsapp, textoConsulta({ negocio: negocioNombre, item: detalle.nombre, precio: detalle.precio, moneda, slug }), pais)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="presionable mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-extrabold"
                  style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
                >
                  <IconWhatsapp className="h-5 w-5" />
                  {t.consultarWhatsapp}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── La barra del carrito ──────────────────────────────── */}
      {puedeAgregar && cantidadTotal > 0 && !abierto && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4">
          <button type="button" onClick={() => setAbierto(true)} className="presionable mx-auto flex w-full max-w-[var(--ancho-menu,520px)] items-center justify-between rounded-2xl px-5 py-4 text-[15px] font-extrabold shadow-flotante" style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}>
            <span>{t.verPedido} · {cantidadTotal}</span>
            <span className="tabular-nums">{$(subtotal)} →</span>
          </button>
        </div>
      )}

      {/* ── La hoja de confirmación ───────────────────────────── */}
      {abierto && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-label={t.tuPedido} className="max-h-[92vh] w-full max-w-[var(--ancho-menu,520px)] overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl" style={{ background: paleta.fondo, color: paleta.tinta, border: `1px solid ${paleta.borde}` }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold">{mesa ? `${t.tuPedido} · ${t.mesa} ${mesa}` : t.tuPedido}</h2>
              <button type="button" onClick={() => setAbierto(false)} aria-label={t.cerrar} className="text-[22px] leading-none">×</button>
            </div>

            <ul className="mt-3 flex max-h-[30vh] flex-col gap-2 overflow-y-auto">
              {carrito.map((l) => {
                const it = porId.get(l.itemId);
                if (!it) return null;
                const detalles = detalleDeLinea(it.personalizacion, l.eleccion);
                return (
                  <li key={l.firma} className="text-[14px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-extrabold tabular-nums">{l.cantidad}×</span> {it.nombre}
                      </span>
                      <span className="tabular-nums" style={{ color: paleta.suave }}>{$(precioDe(l) * l.cantidad)}</span>
                      <button type="button" onClick={() => ajustarLinea(l.firma, -l.cantidad)} aria-label={`${t.quitar} ${it.nombre}`} className="text-[12px] font-bold underline">
                        {t.quitar}
                      </button>
                    </div>
                    {detalles.length > 0 && (
                      <p className="mt-0.5 pl-5 text-[12px] leading-snug" style={{ color: paleta.suave }}>
                        {detalles.join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {paraLlevar && llevar && express && (
              <div className="mt-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: paleta.suave }}>{t.comoLoQueres}</p>
                <div className="mt-2 flex gap-2">
                  <Opcion paleta={paleta} activo={modalidad === "llevar"} onClick={() => setModalidad("llevar")}>
                    {t.llevar}
                    <span className="block text-[11px] font-bold opacity-80">{t.llevarPie}</span>
                  </Opcion>
                  <Opcion paleta={paleta} activo={modalidad === "express"} onClick={() => setModalidad("express")}>
                    {t.express}
                    <span className="block text-[11px] font-bold opacity-80">{costoExpress > 0 ? `+${$(costoExpress)}` : t.envioGratis}</span>
                  </Opcion>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-[14px]" style={{ borderColor: paleta.borde }}>
              {envio > 0 && (
                <div className="flex items-center justify-between" style={{ color: paleta.suave }}>
                  <span>{t.envio}</span>
                  <span className="tabular-nums">{$(envio)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[16px] font-extrabold">
                <span>{t.total}</span>
                <span className="tabular-nums">{$(total)}</span>
              </div>
            </div>

            {paraLlevar ? (
              <div className="mt-4 grid gap-3">
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={TOPES.pedidoNombre} placeholder={t.nombre} autoComplete="name" className={campo} style={estiloCampo} />
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={TOPES.telefono + 4} placeholder={t.telefono} autoComplete="tel" className={campo} style={estiloCampo} />
                <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} maxLength={TOPES.cedula} placeholder={rotuloDocumento} className={campo} style={estiloCampo} />
                {modalidad === "express" && (
                  <textarea value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={TOPES.direccionPedido} rows={2} placeholder={t.direccion} autoComplete="street-address" className={`${campo} text-[14px]`} style={estiloCampo} />
                )}
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: paleta.suave }}>{t.comoPagas}</p>
                  <div className="mt-2 flex gap-2">
                    {metodosPago.map((m) => (
                      <Opcion key={m} paleta={paleta} activo={metodoPago === m} onClick={() => setMetodoPago(m)}>{t.metodos[m]}</Opcion>
                    ))}
                  </div>
                </div>
                <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={TOPES.pedidoNota} rows={2} placeholder={t.nota} className={`${campo} text-[14px]`} style={estiloCampo} />
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={TOPES.pedidoNombre} placeholder={t.nombreOpcional} className={campo} style={estiloCampo} />
                <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={TOPES.pedidoNota} rows={2} placeholder={t.nota} className={`${campo} text-[14px]`} style={estiloCampo} />
              </div>
            )}

            {error && <p className="mt-3 rounded-xl bg-red-600/15 p-3 text-[13px] font-bold text-red-200">{error}</p>}

            <button type="button" onClick={paraLlevar ? enviarParaLlevar : enviarALaMesa} disabled={enviando || carrito.length === 0} className="presionable mt-4 w-full rounded-2xl py-4 text-[15px] font-extrabold disabled:opacity-60" style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}>
              {enviando ? t.enviando : `${t.enviar} · ${$(total)}`}
            </button>
            <p className="mt-2 text-center text-[11.5px]" style={{ color: paleta.suave }}>
              {paraLlevar ? t.pieLlevar : t.pieMesa}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  ARMAR EL PLATO — quitar, agregar y escribir la nota
// ════════════════════════════════════════════════════════════════════
//
// Pedido del dueño (9 sep 2026): «tipo Uber Eats: qué ingredientes
// tiene para poder quitárselos, y que el que lo pide pueda agregar
// notas». Vive en su propio componente y con `key={item.id}`: al abrir
// otro plato React lo remonta y el armado empieza limpio, sin un efecto
// que copie props a estado.
//
// Los ingredientes vienen MARCADOS —el plato los trae— y desmarcarlos
// es pedirlo sin eso; los extras vienen vacíos y suman al precio. El
// botón dice el total de verdad, con extras y por la cantidad elegida:
// nadie tiene que hacer la cuenta de cabeza.

const A: Record<Idioma, { armar: string; incluye: string; extras: string; nota: string; agregar: string }> = {
  es: { armar: "Armar", incluye: "Viene con", extras: "Agregale", nota: "Algo especial con este plato", agregar: "Agregar" },
  en: { armar: "Customize", incluye: "Comes with", extras: "Add to it", nota: "Anything special for this dish", agregar: "Add" },
  fr: { armar: "Composer", incluye: "Contient", extras: "Ajouter", nota: "Une précision pour ce plat", agregar: "Ajouter" },
  it: { armar: "Componi", incluye: "Contiene", extras: "Aggiungi", nota: "Qualcosa di speciale per questo piatto", agregar: "Aggiungi" },
  pt: { armar: "Montar", incluye: "Vem com", extras: "Adicione", nota: "Algo especial para este prato", agregar: "Adicionar" },
  de: { armar: "Anpassen", incluye: "Enthält", extras: "Hinzufügen", nota: "Etwas Besonderes für dieses Gericht", agregar: "Hinzufügen" },
};

function Armar({
  item,
  paleta,
  idioma,
  precio,
  onAgregar,
}: {
  item: Item;
  paleta: Paleta;
  idioma: Idioma;
  /** El formateador de moneda del negocio. */
  precio: (n: number) => string;
  onAgregar: (eleccion: Eleccion, cuantos: number) => void;
}) {
  const a = A[idioma];
  const [sin, setSin] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [nota, setNota] = useState("");
  const [cuantos, setCuantos] = useState(1);

  const eleccion: Eleccion = { sin, extras, nota: nota.trim() };
  const unidad = precioDeLinea(item.precio ?? 0, item.personalizacion, eleccion);
  const alternar = (lista: string[], id: string) =>
    lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];

  const casilla = (marcado: boolean) => (
    <span
      aria-hidden
      className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border text-[13px] font-extrabold"
      style={{
        background: marcado ? paleta.acento : "transparent",
        borderColor: marcado ? paleta.acento : paleta.borde,
        color: paleta.tintaSobreAcento,
      }}
    >
      {marcado ? "✓" : ""}
    </span>
  );

  return (
    <div className="mt-5">
      {item.personalizacion.ingredientes.length > 0 && (
        <>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: paleta.suave }}>
            {a.incluye}
          </p>
          <ul className="mt-2 flex flex-col">
            {item.personalizacion.ingredientes.map((i) => {
              const puesto = !sin.includes(i.id);
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => setSin((v) => alternar(v, i.id))}
                    aria-pressed={puesto}
                    className="flex w-full items-center gap-3 py-2 text-left text-[14.5px]"
                  >
                    {casilla(puesto)}
                    <span className={puesto ? "" : "line-through opacity-55"}>{i.nombre}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {item.personalizacion.extras.length > 0 && (
        <>
          <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: paleta.suave }}>
            {a.extras}
          </p>
          <ul className="mt-2 flex flex-col">
            {item.personalizacion.extras.map((x) => {
              const puesto = extras.includes(x.id);
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    onClick={() => setExtras((v) => alternar(v, x.id))}
                    aria-pressed={puesto}
                    className="flex w-full items-center gap-3 py-2 text-left text-[14.5px]"
                  >
                    {casilla(puesto)}
                    <span className="min-w-0 flex-1">{x.nombre}</span>
                    <span className="shrink-0 text-[13.5px] font-bold tabular-nums" style={{ color: paleta.acento }}>
                      +{precio(x.precio)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        maxLength={TOPES_PERSONALIZACION.nota}
        rows={2}
        placeholder={a.nota}
        className="mt-3 w-full rounded-xl border px-3.5 py-3 text-[14px] outline-none"
        style={{ background: paleta.superficie, borderColor: paleta.borde, color: paleta.tinta }}
      />

      <div className="mt-4 flex items-center gap-3">
        <div className="flex shrink-0 items-center rounded-xl" style={{ border: `1px solid ${paleta.borde}` }}>
          <button type="button" onClick={() => setCuantos((n) => Math.max(1, n - 1))} aria-label="−" className="presionable h-12 w-10 text-[18px] font-extrabold">
            −
          </button>
          <span className="w-7 text-center text-[15px] font-extrabold tabular-nums">{cuantos}</span>
          <button type="button" onClick={() => setCuantos((n) => Math.min(TOPES.cantidadPorRenglon, n + 1))} aria-label="+" className="presionable h-12 w-10 text-[18px] font-extrabold">
            +
          </button>
        </div>
        <button
          type="button"
          onClick={() => onAgregar(eleccion, cuantos)}
          className="presionable flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-extrabold"
          style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}
        >
          <span className="truncate">{a.agregar}</span>
          <span className="tabular-nums">{precio(unidad * cuantos)}</span>
        </button>
      </div>
    </div>
  );
}
