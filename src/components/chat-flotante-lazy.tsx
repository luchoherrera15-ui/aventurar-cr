"use client";

import dynamic from "next/dynamic";

/**
 * `ssr: false` en `next/dynamic` no se puede escribir directo en un
 * Server Component (RootLayout) — Next lo rechaza en build. Este
 * archivo es el envoltorio cliente mínimo que sí lo permite; ver
 * layout.tsx para el motivo de diferir esta carga.
 */
export default dynamic(() => import("./chat-flotante"), { ssr: false });
