import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CampanasPanel, { type PerfilCampana } from "./campanas-panel";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /admin/campanas — QUIÉN ES CADA CUENTA, ANTES DE ESCRIBIRLE
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (27 ago 2026): «necesito filtrar por cuentas demos,
 * cuentas de Pura Matcha, cuentas de x cosa». Y después: «las cuentas
 * se crean juntas como si todo fuera del marketplace — todo lo que se
 * registre en /lealtad es algo totalmente aparte».
 *
 * ── EL PROBLEMA QUE ESTO ARREGLA ────────────────────────────────────
 *
 * La lista mostraba las 450 cuentas de auth en una sola columna «rol»
 * que solo sabía decir Cliente/Proveedor/Admin. Ahí adentro venían
 * mezclados los dueños del marketplace, los negocios de Lealtad, los
 * clientes finales de cada negocio de Lealtad y 400 cuentas de utilería
 * del demo. Escribirle «a los clientes» era escribirle a esa sopa.
 *
 * Ahora cada fila llega CLASIFICADA POR ORIGEN, calculado acá en el
 * servidor contra las tablas que de verdad lo saben:
 *
 *   marketplace      dueño de una publicación del directorio
 *   lealtad          dueño de un negocio de Bookea Lealtad
 *                    (`en_marketplace = false`, el eje de la 0187)
 *   cliente_lealtad  cliente final de un negocio de lealtad — CON el
 *                    nombre del negocio, para poder filtrar «los de
 *                    Pura Matcha»
 *   demo             utilería (`*.demo@bookea.lat` o sembrada por un
 *                    seed) — para excluirla de una campaña real
 *   cliente          persona que se registró a reservar
 *
 * ── LOS CLIENTES DE LEALTAD SIN CUENTA TAMBIÉN ESTÁN ────────────────
 *
 * 41 de los 45 clientes de lealtad NO tienen cuenta de Bookea: son un
 * correo y un nombre en `clientes_negocio` (así los registra el
 * mostrador). Antes eran INALCANZABLES desde esta pantalla — que lista
 * `perfiles` — y son justamente «las cuentas de Pura Matcha» que el
 * dueño pidió filtrar.
 *
 * Se puede porque el envío siempre trabajó con CORREOS, no con ids
 * (ver `actions.ts`): agregarlos a la lista alcanzó. Su id de fila es
 * sintético (`correo:<email>`) porque no hay perfil que apuntar.
 */

export default async function AdminCampanasPage() {
  const supabase = await createClient();
  // `clientes_negocio` está protegida por RLS a su negocio: para leer
  // la lista completa hace falta la llave de servicio, igual que hace
  // el resto del panel de admin (el gate de admin vive en el layout).
  const admin = createAdminClient();

  const [{ data, error }, ranchosRes, clientesRes] = await Promise.all([
    supabase
      .from("perfiles")
      .select("id, email, nombre, rol")
      .not("email", "is", null)
      .order("created_at", { ascending: false }),
    admin
      ? admin.from("ranchos").select("id, owner_id, nombre, en_marketplace")
      : Promise.resolve({ data: null }),
    admin
      ? admin.from("clientes_negocio").select("cliente_id, correo, nombre, rancho_id")
      : Promise.resolve({ data: null }),
  ]);

  // ── Quién es dueño de qué, y cómo se llama cada negocio ──
  type FilaRancho = {
    id: string;
    owner_id: string | null;
    nombre: string;
    en_marketplace: boolean | null;
  };
  const filasRancho = (ranchosRes.data ?? []) as FilaRancho[];

  const negociosPorDueno = new Map<string, { nombre: string; lealtad: boolean }[]>();
  const idRanchoANombre = new Map<string, string>();
  for (const r of filasRancho) {
    idRanchoANombre.set(r.id, r.nombre);
    if (!r.owner_id) continue;
    const lista = negociosPorDueno.get(r.owner_id) ?? [];
    lista.push({ nombre: r.nombre, lealtad: r.en_marketplace === false });
    negociosPorDueno.set(r.owner_id, lista);
  }

  // ── Quién es cliente final de qué negocio de lealtad ──
  const lealtadPorCuenta = new Map<string, string>();
  const lealtadPorCorreo = new Map<string, string>();
  const sinCuenta: { correo: string; nombre: string | null; negocio: string }[] = [];
  const correosConPerfil = new Set(
    (data ?? []).map((p) => String(p.email ?? "").toLowerCase()),
  );
  for (const c of (clientesRes.data ?? []) as {
    cliente_id: string | null;
    correo: string | null;
    nombre: string | null;
    rancho_id: string;
  }[]) {
    const negocio = idRanchoANombre.get(c.rancho_id) ?? "un negocio de lealtad";
    if (c.cliente_id) lealtadPorCuenta.set(c.cliente_id, negocio);
    if (c.correo) {
      lealtadPorCorreo.set(c.correo, negocio);
      if (!c.cliente_id && !correosConPerfil.has(c.correo)) {
        sinCuenta.push({ correo: c.correo, nombre: c.nombre, negocio });
      }
    }
  }

  const esDemo = (email: string) => /\.demo@bookea\.lat$/i.test(email);

  const perfiles: PerfilCampana[] = (data ?? [])
    .filter((p) => Boolean(p.email))
    .map((p) => {
      const email = (p.email as string).toLowerCase();
      const negocios = negociosPorDueno.get(p.id as string) ?? [];
      const deLealtad = negocios.filter((n) => n.lealtad);
      const deMarketplace = negocios.filter((n) => !n.lealtad);
      const clienteDe =
        lealtadPorCuenta.get(p.id as string) ?? lealtadPorCorreo.get(email) ?? null;

      // El orden de los `if` ES la regla de desempate: una cuenta demo
      // es demo aunque sea dueña de algo (las del seed lo son), y un
      // dueño real se clasifica por su negocio antes que por ser
      // también cliente de otro.
      const origen: PerfilCampana["origen"] = esDemo(email)
        ? "demo"
        : deLealtad.length > 0
          ? "lealtad"
          : deMarketplace.length > 0
            ? "marketplace"
            : clienteDe
              ? "cliente_lealtad"
              : "cliente";

      return {
        id: p.id as string,
        email: p.email as string,
        nombre: (p.nombre as string | null) ?? null,
        rol: p.rol as PerfilCampana["rol"],
        origen,
        negocio:
          origen === "lealtad"
            ? deLealtad.map((n) => n.nombre).join(", ")
            : origen === "marketplace"
              ? deMarketplace.map((n) => n.nombre).join(", ")
              : origen === "cliente_lealtad"
                ? clienteDe
                : null,
      };
    });

  // Los contactos de lealtad sin cuenta, al final: alcanzables por
  // correo aunque nunca se hayan registrado.
  for (const c of sinCuenta) {
    perfiles.push({
      id: `correo:${c.correo}`,
      email: c.correo,
      nombre: c.nombre,
      rol: "cliente",
      origen: "cliente_lealtad",
      negocio: c.negocio,
    });
  }

  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-navy before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-navy">
        Plataforma
      </p>
      <h1 className="mt-1 text-2xl font-bold text-aventurea-ink">
        Campañas de correo
      </h1>
      <p className="mb-6 mt-1 max-w-[70ch] text-[13.5px] text-aventurea-ink-soft">
        Elegí a quiénes escribirles, armá el correo y envialo — sale con la
        plantilla de la marca a todas las cuentas seleccionadas.
      </p>

      {error && (
        <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          No se pudieron cargar las cuentas: {error.message}
        </p>
      )}

      <CampanasPanel perfiles={perfiles} />
    </div>
  );
}
