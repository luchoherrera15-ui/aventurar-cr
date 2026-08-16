/**
 * LA MATRIZ DE VARIABLES DE ENTORNO DE WALLET — fuente única.
 *
 * Los datos de "dónde se consume cada variable" salen de la auditoría
 * de Fase 0 (docs/wallet-v2/auditoria-inicial.md, sección 6): un barrido
 * exhaustivo de `process.env.*` en todo el repo confirmó que estas son
 * las ÚNICAS 7 variables de Wallet que el código real lee — no hay
 * ninguna `APNS_*` separada (el push reusa las credenciales del pase) ni
 * ninguna variable adicional en scripts/Edge Functions/CI.
 *
 * Esta lista es DATO, no lógica: quien agregue una variable nueva la
 * agrega acá, y `wallet:doctor`/el panel la recogen solos.
 */

export type EntradaInventario = {
  variable: string;
  entorno: "Apple" | "Google";
  obligatoria: boolean;
  formato: "Base64 → PEM" | "Base64 → JSON" | "texto plano";
  consumidores: string[];
  descripcion: string;
};

export const INVENTARIO_WALLET: readonly EntradaInventario[] = [
  {
    variable: "APPLE_PASS_CERT_B64",
    entorno: "Apple",
    obligatoria: true,
    formato: "Base64 → PEM",
    consumidores: ["src/lib/wallet/firma.ts", "src/lib/wallet/config/apple.ts"],
    descripcion: "Certificado del Pass Type ID (exportado del .p12), en Base64.",
  },
  {
    variable: "APPLE_PASS_KEY_B64",
    entorno: "Apple",
    obligatoria: true,
    formato: "Base64 → PEM",
    consumidores: ["src/lib/wallet/firma.ts", "src/lib/wallet/config/apple.ts"],
    descripcion: "Llave privada correspondiente al certificado del Pass Type ID, en Base64.",
  },
  {
    variable: "APPLE_WWDR_CERT_B64",
    entorno: "Apple",
    obligatoria: true,
    formato: "Base64 → PEM",
    consumidores: ["src/lib/wallet/firma.ts", "src/lib/wallet/config/apple.ts"],
    descripcion: "Certificado intermedio Apple Worldwide Developer Relations, en Base64.",
  },
  {
    variable: "APPLE_PASS_TYPE_ID",
    entorno: "Apple",
    obligatoria: true,
    formato: "texto plano",
    consumidores: ["src/lib/wallet/firma.ts", "src/lib/wallet/apns.ts (como apns-topic)"],
    descripcion: 'Identificador del Pass Type, con el prefijo "pass." (ej. pass.lat.bookea.afiliacion).',
  },
  {
    variable: "APPLE_TEAM_ID",
    entorno: "Apple",
    obligatoria: true,
    formato: "texto plano",
    consumidores: ["src/lib/wallet/firma.ts"],
    descripcion: "Team ID de la cuenta Apple Developer (10 caracteres alfanuméricos).",
  },
  {
    variable: "GOOGLE_WALLET_ISSUER_ID",
    entorno: "Google",
    obligatoria: true,
    formato: "texto plano",
    consumidores: ["src/lib/wallet/google.ts", "src/lib/wallet/config/google.ts"],
    descripcion: "Issuer ID numérico asignado por Google Wallet Console.",
  },
  {
    variable: "GOOGLE_WALLET_SA_KEY_B64",
    entorno: "Google",
    obligatoria: true,
    formato: "Base64 → JSON",
    consumidores: ["src/lib/wallet/google.ts", "src/lib/wallet/config/google.ts"],
    descripcion: "JSON completo de la cuenta de servicio de Google Cloud, en Base64.",
  },
  {
    // Fase 2C: a propósito NO es obligatoria — hoy (producción) no
    // existe todavía, y el sistema funciona igual que siempre sin ella
    // (token legacy aleatorio). Se agrega al inventario para que
    // wallet:doctor la informe explícitamente en vez de quedar muda,
    // sin que su ausencia cuente como error.
    variable: "APPLE_PASS_AUTH_SECRET_V1",
    entorno: "Apple",
    obligatoria: false,
    formato: "texto plano",
    consumidores: ["src/lib/wallet/config/auth-token.ts", "src/lib/wallet/generar.ts"],
    descripcion:
      "Secreto HMAC dedicado para el token de autenticación de pases NUEVOS (versión 1). No es el certificado ni la private key de Apple — es un secreto propio de Bookea, sin relación con APPLE_PASS_KEY_B64.",
  },
] as const;

export type EstadoPresencia = {
  variable: string;
  presente: boolean;
  obligatoria: boolean;
};

/**
 * Solo confirma PRESENCIA (¿existe la variable en este proceso?), nunca
 * el valor. Sirve tanto para `.env.local` (si se cargó con dotenv antes
 * de llamar a esto) como para el entorno real de ejecución.
 */
export function presenciaEnEntorno(env: Record<string, string | undefined> = process.env): EstadoPresencia[] {
  return INVENTARIO_WALLET.map((e) => ({ variable: e.variable, presente: !!env[e.variable], obligatoria: e.obligatoria }));
}
