import { redirect } from "next/navigation";
import { miNegocioFood } from "@/lib/food/auth";
import CheckInPanel from "./check-in-panel";

export default async function CheckInFoodPage() {
  const negocio = await miNegocioFood();
  if (!negocio) redirect("/food/negocio/nuevo");

  return <CheckInPanel negocioId={negocio.id} />;
}
