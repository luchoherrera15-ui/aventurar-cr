import { redirect } from "next/navigation";

/**
 * La portada-selector se eliminó (pedido del dueño): entrar a
 * bookea.lat aterriza DIRECTO en el directorio de eventos, que ya trae
 * el conmutador compacto de las tres verticales arriba. Menos ceremonia
 * para llegar a reservar.
 */
export default function Home() {
  redirect("/eventos");
}
