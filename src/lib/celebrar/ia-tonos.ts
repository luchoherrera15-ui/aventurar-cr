/** Los tonos que la persona elige al pedirle un texto a la IA del editor. */
export const TONOS = ["calido", "elegante", "divertido", "formal", "breve"] as const;
export type TonoIA = (typeof TONOS)[number];
export const NOMBRE_TONO: Record<TonoIA, string> = {
  calido: "Cálido",
  elegante: "Elegante",
  divertido: "Divertido",
  formal: "Formal",
  breve: "Breve",
};
