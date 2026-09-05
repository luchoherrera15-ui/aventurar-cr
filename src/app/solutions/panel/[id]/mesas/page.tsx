import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { toString as qrATexto } from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAccesoSolutions } from "@/lib/solutions/acceso";
import { negocioPorId } from "@/lib/solutions/datos";
import { TOPES, urlDelNegocio } from "@/lib/solutions/tipos";

export const metadata: Metadata = { title: "QR de mesas · Bookea Solutions" };

/**
 * /solutions/panel/<id>/mesas — LA HOJA DE QR, UNA POR MESA, PARA IMPRIMIR.
 *
 * Cada QR abre /s/<slug>/menu?mesa=N. El número viaja en el link, así
 * que la comanda sabe de qué mesa vino sin que nadie lo escriba. Se
 * imprime con Ctrl+P: la hoja ya viene en tarjetas de 4 por fila con
 * salto de página cada 12, y sin el chrome del panel.
 *
 * `?mesas=` permite imprimir una cantidad distinta a la guardada (el
 * dueño que acaba de teclear 20 y todavía no tocó «Guardar»).
 */
export default async function HojaMesasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const busqueda = await searchParams;
  const acceso = await verificarAccesoSolutions(id);
  if (!acceso.user) redirect("/cuenta?volver=solutions");
  if (!acceso.ok) redirect("/solutions/panel");

  const admin = createAdminClient();
  if (!admin) notFound();
  const negocio = await negocioPorId(admin, id);
  if (!negocio) notFound();

  const pedido = Number(Array.isArray(busqueda.mesas) ? busqueda.mesas[0] : busqueda.mesas);
  const cantidad = Math.max(0, Math.min(TOPES.mesas, Number.isFinite(pedido) && pedido > 0 ? Math.trunc(pedido) : negocio.mesas));
  // Con dominio propio activo, el QR lleva ese dominio (0234). Solo si
  // está activo: un QR impreso con un dominio que no sirve es un QR roto.
  const base = urlDelNegocio(negocio);

  const tarjetas = await Promise.all(
    Array.from({ length: cantidad }, (_, i) => i + 1).map(async (n) => ({
      n,
      svg: await qrATexto(`${base}/menu?mesa=${n}`, { type: "svg", margin: 1, width: 220, color: { dark: "#0a1226", light: "#ffffff" } }),
    })),
  );

  return (
    <main className="min-h-svh bg-white p-6 text-[#0a1226] print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href={`/solutions/panel/${id}?tab=pagina`} className="text-[12.5px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink">
            ← Volver al panel
          </Link>
          <h1 className="titulo mt-1 text-[24px]">QR de mesas · {negocio.nombre}</h1>
          <p className="mt-1 text-[13px] text-aventurea-ink-soft">
            {cantidad === 0 ? "Indicá cuántas mesas tenés en «Mi página» para generar los QR." : `${cantidad} mesas. Imprimí con Ctrl+P y recortá.`}
          </p>
        </div>
        {cantidad > 0 && (
          <a href="#" onClick={undefined} className="presionable inline-flex min-h-[44px] items-center rounded-xl bg-[#16295e] px-5 text-[14px] font-extrabold text-white" data-imprimir>
            Imprimir
          </a>
        )}
      </div>

      {cantidad > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 print:gap-3">
          {tarjetas.map((t) => (
            <div key={t.n} className="flex flex-col items-center rounded-2xl border border-[#dbe3f4] p-4 text-center print:break-inside-avoid print:rounded-none">
              {negocio.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={negocio.logo_url} alt="" className="mb-2 h-9 w-9 rounded-lg object-cover" />
              ) : (
                <p className="mb-2 max-w-full truncate text-[12px] font-extrabold uppercase tracking-[0.12em]">{negocio.nombre}</p>
              )}
              <div className="w-full max-w-[200px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: t.svg }} />
              <p className="mt-2 text-[26px] font-extrabold leading-none">Mesa {t.n}</p>
              <p className="mt-1.5 text-[11px] leading-snug text-[#5b6b8a]">Escaneá para ver el menú{negocio.acepta_pedidos ? " y pedir" : ""}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sin JS de cliente para imprimir: un enlace con onclick inline
          rompe la regla de "use client"; window.print() va en un script
          mínimo. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.querySelector('[data-imprimir]')?.addEventListener('click',function(e){e.preventDefault();window.print();});`,
        }}
      />
    </main>
  );
}
