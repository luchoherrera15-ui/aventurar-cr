import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientePage from "./cliente-page";

// Los server actions de esta página disparan la generación con IA
// (minutos): sin esto, Vercel corta la función a mitad de camino.
export const maxDuration = 300;

export default async function PaginaCreadorInvitaciones() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/cuenta");
  }

  return <ClientePage />;
}
