/**
 * El marcador que antepone el asistente de IA a sus respuestas
 * automáticas (`src/lib/asistente-ia.ts`) — separado en su propio
 * archivo, sin ningún otro import, para que los componentes de chat
 * ("use client") puedan detectarlo y mostrar un ícono en vez del
 * marcador crudo, sin arrastrar al bundle del navegador el resto de
 * `asistente-ia.ts` (que sí usa la service_role key).
 */
export const PREFIJO_ASISTENTE = "💎 ";
