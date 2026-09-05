"use client";

import { useMemo, useState, useTransition } from "react";
import { fmtColones } from "@/lib/finanzas";
import { ALERGENO, IDIOMA, type Alergeno, type Idioma, type IdiomaExtra, type Nutricion } from "@/lib/solutions/idiomas";
import { TOPES, type MetodoPago } from "@/lib/solutions/tipos";
import { pedirDesdeLaMesa, pedirParaLlevar } from "./pedir-actions";

type Item = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number | null;
  foto_url: string | null;
  nutricion: Nutricion | null;
};
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
  paleta,
  idioma = "es",
  idiomas = [],
  llevar = false,
  express = false,
  costoExpress = 0,
  metodosPago = ["efectivo"],
}: {
  negocioId: string;
  slug: string;
  mesa: number | null;
  /** Desde la mesa: add-on + interruptor + número de mesa. */
  puedePedir: boolean;
  grupos: Grupo[];
  paleta: Paleta;
  /** El idioma en que ya vienen los textos, y los que se pueden elegir. */
  idioma?: Idioma;
  idiomas?: IdiomaExtra[];
  /** To go / exprés (0233). Los decide el servidor con el add-on y los interruptores. */
  llevar?: boolean;
  express?: boolean;
  costoExpress?: number;
  metodosPago?: MetodoPago[];
}) {
  const t = T[idioma];
  const paraLlevar = mesa === null && (llevar || express);
  const puedeAgregar = puedePedir || paraLlevar;

  const [carrito, setCarrito] = useState<Record<string, number>>({});
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<Item | null>(null);
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
  const renglones = Object.entries(carrito).filter(([, c]) => c > 0);
  const cantidadTotal = renglones.reduce((s, [, c]) => s + c, 0);
  const subtotal = renglones.reduce((s, [id, c]) => s + (porId.get(id)?.precio ?? 0) * c, 0);
  const envio = paraLlevar && modalidad === "express" ? costoExpress : 0;
  const total = subtotal + envio;

  const ajustar = (id: string, delta: number) =>
    setCarrito((prev) => {
      const n = Math.max(0, Math.min(TOPES.cantidadPorRenglon, (prev[id] ?? 0) + delta));
      const copia = { ...prev };
      if (n === 0) delete copia[id];
      else copia[id] = n;
      return copia;
    });

  const limpiar = () => {
    setCarrito({});
    setNota("");
    setAbierto(false);
  };

  const enviarALaMesa = () => {
    if (!mesa) return;
    setError(null);
    arrancar(async () => {
      const r = await pedirDesdeLaMesa({ negocioId, slug, mesa, nombre, nota, renglones: renglones.map(([id, cantidad]) => ({ itemId: id, cantidad })) });
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
      const r = await pedirParaLlevar({ negocioId, slug, modalidad, nombre, telefono, cedula, direccion, metodoPago, nota, renglones: renglones.map(([id, cantidad]) => ({ itemId: id, cantidad })) });
      if (!r.ok) return setError(r.motivo);
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
        <div className="mx-auto mt-4 w-full max-w-[520px] px-5">
          <div className="rounded-2xl border p-4" style={{ background: paleta.superficie, borderColor: paleta.acento }}>
            {enviado.tipo === "mesa" ? (
              <>
                <p className="text-[15px] font-extrabold">✓ {t.enviadoMesa} {mesa}</p>
                <p className="mt-1 text-[13px]" style={{ color: paleta.suave }}>
                  {enviado.renglones} · {fmtColones(enviado.total)}. {t.enviadoMesaPie}
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-extrabold">
                  ✓ {t.recibido} #{enviado.codigo} · {enviado.tipo === "express" ? t.express : t.llevar}
                </p>
                <p className="mt-1 text-[13px]" style={{ color: paleta.suave }}>
                  {fmtColones(enviado.total)} · {t.pagas} {t.metodos[enviado.metodoPago].toLowerCase()}.{" "}
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
        <nav aria-label={t.idioma} className="mx-auto mt-4 flex w-full max-w-[520px] flex-wrap gap-1.5 px-5">
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
          <ul className="mx-auto flex w-full max-w-[520px] gap-2">
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

      {/* ── El menú ────────────────────────────────────────────── */}
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-7 px-5 pt-4">
        {grupos.map((g) => (
          <section key={g.nombre} id={seccionId(g.nombre)} className="scroll-mt-14">
            <h2 className="text-[13px] font-extrabold uppercase tracking-[0.14em]" style={{ color: paleta.suave }}>
              {g.nombre}
            </h2>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {g.items.map((it) => {
                const cant = carrito[it.id] ?? 0;
                const pedible = puedeAgregar && it.precio !== null;
                return (
                  <li key={it.id} className="flex items-center gap-3 rounded-2xl border p-3" style={{ background: paleta.superficie, borderColor: cant > 0 ? paleta.acento : paleta.borde }}>
                    {/* La foto y el nombre abren la ficha. */}
                    <button type="button" onClick={() => setDetalle(it)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      {it.foto_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.foto_url} alt="" className="h-[60px] w-[60px] shrink-0 rounded-xl object-cover" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-extrabold leading-tight">{it.nombre}</span>
                        {it.descripcion && (
                          <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug" style={{ color: paleta.suave }}>
                            {it.descripcion}
                          </span>
                        )}
                        <span className="mt-1 block text-[14px] font-bold tabular-nums" style={{ color: paleta.acento }}>
                          {it.precio === null ? t.consultar : fmtColones(it.precio)}
                          {it.nutricion && <span className="ml-2 text-[11px] font-bold" style={{ color: paleta.suave }}>ⓘ</span>}
                        </span>
                      </span>
                    </button>
                    {pedible &&
                      (cant === 0 ? (
                        <button type="button" onClick={() => ajustar(it.id, 1)} aria-label={`${t.agregar} ${it.nombre}`} className="presionable grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[20px] font-extrabold" style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}>
                          +
                        </button>
                      ) : (
                        <div className="flex shrink-0 items-center rounded-xl" style={{ border: `1px solid ${paleta.acento}` }}>
                          <button type="button" onClick={() => ajustar(it.id, -1)} aria-label={`${t.quitar} ${it.nombre}`} className="presionable h-10 w-9 text-[18px] font-extrabold">−</button>
                          <span className="w-6 text-center text-[14px] font-extrabold tabular-nums">{cant}</span>
                          <button type="button" onClick={() => ajustar(it.id, 1)} aria-label={`${t.agregar} ${it.nombre}`} className="presionable h-10 w-9 text-[18px] font-extrabold">+</button>
                        </div>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* ── La ficha del plato ────────────────────────────────── */}
      {detalle && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" onClick={() => setDetalle(null)}>
          <div role="dialog" aria-modal="true" aria-label={detalle.nombre} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl sm:rounded-3xl" style={{ background: paleta.fondo, color: paleta.tinta, border: `1px solid ${paleta.borde}` }}>
            {detalle.foto_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detalle.foto_url} alt="" className="aspect-[4/3] w-full object-cover" />
            )}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[20px] font-extrabold leading-tight">{detalle.nombre}</h2>
                <button type="button" onClick={() => setDetalle(null)} aria-label={t.cerrar} className="text-[24px] leading-none">×</button>
              </div>
              {detalle.descripcion && <p className="mt-2 text-[14px] leading-relaxed" style={{ color: paleta.suave }}>{detalle.descripcion}</p>}
              <p className="mt-3 text-[18px] font-extrabold tabular-nums" style={{ color: paleta.acento }}>
                {detalle.precio === null ? t.consultar : fmtColones(detalle.precio)}
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
                <button type="button" onClick={() => { ajustar(detalle.id, 1); setDetalle(null); }} className="presionable mt-5 w-full rounded-2xl py-3.5 text-[15px] font-extrabold" style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}>
                  + {t.agregar}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── La barra del carrito ──────────────────────────────── */}
      {puedeAgregar && cantidadTotal > 0 && !abierto && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4">
          <button type="button" onClick={() => setAbierto(true)} className="presionable mx-auto flex w-full max-w-[520px] items-center justify-between rounded-2xl px-5 py-4 text-[15px] font-extrabold shadow-flotante" style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}>
            <span>{t.verPedido} · {cantidadTotal}</span>
            <span className="tabular-nums">{fmtColones(subtotal)} →</span>
          </button>
        </div>
      )}

      {/* ── La hoja de confirmación ───────────────────────────── */}
      {abierto && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div role="dialog" aria-modal="true" aria-label={t.tuPedido} className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl" style={{ background: paleta.fondo, color: paleta.tinta, border: `1px solid ${paleta.borde}` }}>
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-extrabold">{mesa ? `${t.tuPedido} · ${t.mesa} ${mesa}` : t.tuPedido}</h2>
              <button type="button" onClick={() => setAbierto(false)} aria-label={t.cerrar} className="text-[22px] leading-none">×</button>
            </div>

            <ul className="mt-3 flex max-h-[30vh] flex-col gap-2 overflow-y-auto">
              {renglones.map(([id, c]) => {
                const it = porId.get(id);
                if (!it) return null;
                return (
                  <li key={id} className="flex items-center justify-between gap-3 text-[14px]">
                    <span className="min-w-0 flex-1 truncate"><span className="font-extrabold tabular-nums">{c}×</span> {it.nombre}</span>
                    <span className="tabular-nums" style={{ color: paleta.suave }}>{fmtColones((it.precio ?? 0) * c)}</span>
                    <button type="button" onClick={() => ajustar(id, -c)} aria-label={`${t.quitar} ${it.nombre}`} className="text-[12px] font-bold underline">{t.quitar}</button>
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
                    <span className="block text-[11px] font-bold opacity-80">{costoExpress > 0 ? `+${fmtColones(costoExpress)}` : t.envioGratis}</span>
                  </Opcion>
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-[14px]" style={{ borderColor: paleta.borde }}>
              {envio > 0 && (
                <div className="flex items-center justify-between" style={{ color: paleta.suave }}>
                  <span>{t.envio}</span>
                  <span className="tabular-nums">{fmtColones(envio)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[16px] font-extrabold">
                <span>{t.total}</span>
                <span className="tabular-nums">{fmtColones(total)}</span>
              </div>
            </div>

            {paraLlevar ? (
              <div className="mt-4 grid gap-3">
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={TOPES.pedidoNombre} placeholder={t.nombre} autoComplete="name" className={campo} style={estiloCampo} />
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={TOPES.telefono + 4} placeholder={t.telefono} autoComplete="tel" className={campo} style={estiloCampo} />
                <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} maxLength={TOPES.cedula} placeholder={t.cedula} className={campo} style={estiloCampo} />
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

            <button type="button" onClick={paraLlevar ? enviarParaLlevar : enviarALaMesa} disabled={enviando || renglones.length === 0} className="presionable mt-4 w-full rounded-2xl py-4 text-[15px] font-extrabold disabled:opacity-60" style={{ background: paleta.acento, color: paleta.tintaSobreAcento }}>
              {enviando ? t.enviando : `${t.enviar} · ${fmtColones(total)}`}
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
