import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { toString as qrATexto } from "qrcode";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { paginaDelNegocio, urlDePagina, TOPE_MESAS } from "@/lib/lealtad/pagina-negocio";
import BotonImprimir from "../boton-imprimir";
import "./mesas.css";

/**
 * LA HOJA DE QRs POR MESA (0229) — la PREVISTA de pedidos, imprimible.
 *
 * Cada tarjeta de la hoja lleva /r/<slug>?mesa=N: hoy todas abren la
 * misma página, pero el número ya viaja en el link — cuando los
 * pedidos por mesa se activen, el sistema sabrá de qué mesa vino cada
 * uno SIN reimprimir un solo QR (la lección de /tarjeta: el papel es
 * inmutable, el destino se diseña bien desde el día uno).
 *
 * `?mesas=N` en la URL pisa la cantidad guardada — mismo contrato que
 * `?estilo=` del póster: el link compartido, el F5 y el imprimir dan
 * la misma hoja.
 *
 * QR nivel M (no H): va parado en una mesa a 30 cm de la cara, no
 * pegado en una pared — el mismo criterio que el QR del mostrador.
 */

export default async function HojaMesasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mesas?: string }>;
}) {
  const { id } = await params;
  const { mesas: mesasPedidas } = await searchParams;

  const acceso = await verificarAccesoLealtad(id);
  if (!acceso.user) redirect("/lealtad/login");
  if (!acceso.ok) redirect("/lealtad/panel");

  const admin = createAdminClient();
  if (!admin) notFound();

  const [{ data: rancho }, pagina] = await Promise.all([
    admin.from("ranchos").select("id, nombre, slug").eq("id", id).maybeSingle(),
    paginaDelNegocio(admin, id),
  ]);
  if (!rancho || !rancho.slug) notFound();

  const slug = rancho.slug as string;
  const nombre = (rancho.nombre as string) ?? "";

  const deUrl = /^\d{1,2}$/.test(mesasPedidas ?? "") ? parseInt(mesasPedidas as string, 10) : null;
  const cantidad = Math.max(1, Math.min(TOPE_MESAS, deUrl ?? pagina?.mesas ?? 8));

  const mesas = await Promise.all(
    Array.from({ length: cantidad }, (_, i) => i + 1).map(async (n) => ({
      n,
      svg: await qrATexto(`${urlDePagina(slug)}?mesa=${n}`, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        color: { dark: "#0a1226", light: "#ffffff" },
      }),
    })),
  );

  return (
    <main className="min-h-svh bg-aventurea-cream px-4 py-6">
      <div className="no-imprimir mx-auto mb-5 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/lealtad/panel/${id}#mi-pagina`}
            className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
          >
            ← Mi página
          </Link>
          <h1 className="titulo mt-1 text-[22px] text-aventurea-ink">
            QRs de mesa · {nombre}
          </h1>
          <p className="mt-0.5 max-w-[52ch] text-[12.5px] text-aventurea-ink-soft">
            {cantidad} {cantidad === 1 ? "mesa" : "mesas"} — recortá por la línea punteada.
            La cantidad se cambia en «Mi página» de tu panel.
          </p>
        </div>
        <BotonImprimir />
      </div>

      <div className="hoja-mesas shadow-elevado">
        {mesas.map((m) => (
          <div key={m.n} className="mesa-card">
            <p className="mesa-negocio">{nombre}</p>
            <p className="mesa-numero">Mesa {m.n}</p>
            <span aria-hidden className="mesa-qr" dangerouslySetInnerHTML={{ __html: m.svg }} />
            <p className="mesa-pie">Escaneá para ver el menú y sumar en tu tarjeta</p>
          </div>
        ))}
      </div>
    </main>
  );
}
