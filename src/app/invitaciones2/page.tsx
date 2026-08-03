import { redirect } from "next/navigation";

// /invitaciones2 fue el borrador de esta landing mientras convivía con
// la vieja /invitaciones para poder compararlas. Ya se decidió: esta
// pasó a ser la /invitaciones oficial (ver ese archivo) y acá solo
// queda el redirect, para no romper links o marcadores viejos.
export default function Invitaciones2Redirect() {
  redirect("/invitaciones");
}
