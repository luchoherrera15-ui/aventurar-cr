import { NextResponse } from "next/server";

/**
 * La descripción de la API en formato OpenAPI, para que un integrador
 * la cargue en Postman o le genere un cliente sin copiar nada a mano.
 *
 * Es PÚBLICA y estática: no hay credencial, no toca la base y no
 * describe ni un dato de nadie — solo la forma de los mensajes. Que la
 * documentación sea pública también es una decisión de seguridad: la
 * ausencia de `GET /miembros` es una propiedad del diseño, y conviene
 * que se vea.
 */

export const runtime = "nodejs";
export const revalidate = 86400;

const RESPUESTA_ERROR = {
  description: "Error, en español y con código estable.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              codigo: { type: "string", example: "scope_faltante" },
              mensaje: { type: "string" },
              campo: { type: "string" },
            },
          },
          request_id: { type: "string", format: "uuid" },
        },
      },
    },
  },
} as const;

const DOCUMENTO = {
  openapi: "3.1.0",
  info: {
    title: "Bookea Lealtad API",
    version: "1.1.0",
    description:
      "API del programa de lealtad de Bookea, para UN caso de uso: que la caja del negocio " +
      "le sume un sello al cliente y el pase del teléfono se actualice solo. Tres endpoints, " +
      "dos permisos, y nada más. Acceso por registro y aprobación: Bookea admite al " +
      "desarrollador y el dueño de cada negocio lo autoriza en su panel. Esta API NO devuelve " +
      "datos personales de los clientes del negocio: no hay nombre, teléfono, correo ni " +
      "listado de miembros, con ningún permiso.",
    contact: { name: "Bookea", url: "https://bookea.lat/lealtad/developers" },
  },
  servers: [{ url: "https://bookea.lat/api/lealtad/v1" }],
  components: {
    securitySchemes: {
      llave: {
        type: "http",
        scheme: "bearer",
        description:
          "Authorization: Bearer blk_live_<kid>.<secreto>. La llave es de servidor a servidor: " +
          "la API no manda cabeceras CORS a propósito, porque un navegador nunca debe tenerla.",
      },
    },
  },
  security: [{ llave: [] }],
  paths: {
    "/yo": {
      get: {
        summary: "Quién soy y qué me dejaron hacer",
        description: "No exige scope. Confirma la llave, el negocio, la tarjeta y los permisos.",
        responses: { "200": { description: "La credencial y su alcance." }, "401": RESPUESTA_ERROR },
      },
    },
    "/saldo": {
      get: {
        summary: "El saldo de una tarjeta",
        description:
          "Scope `saldo`. Acepta `serial` (el QR que el cliente enseña) O `ref` (el que " +
          "guardaste de esa tarjeta), exactamente uno de los dos. Devuelve el `ref` opaco: " +
          "guardá el ref, NO guardés el serial. Límite propio de 20 por minuto.",
        parameters: [
          {
            name: "serial",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "El código del pase presentado. Excluyente con `ref`.",
          },
          {
            name: "ref",
            in: "query",
            required: false,
            schema: { type: "string", pattern: "^mb_[0-9A-HJKMNP-TV-Z]{16}$" },
            description: "El seudónimo que guardaste de esa tarjeta. Excluyente con `serial`.",
          },
        ],
        responses: {
          "200": { description: "Saldo, meta, `faltan` e iniciales (dos letras)." },
          "400": RESPUESTA_ERROR,
          "404": RESPUESTA_ERROR,
          "429": RESPUESTA_ERROR,
        },
      },
    },
    "/acreditaciones": {
      post: {
        summary: "Sumar puntos o sellos al cobrar",
        description:
          "Scope `acreditar`. Acepta EXACTAMENTE tres campos. `referencia` es obligatoria: " +
          "es la llave de idempotencia, y el reintento con la misma referencia devuelve 200 " +
          "con `duplicada: true` sin sumar de nuevo. Al acreditar, el pase de Apple Wallet o " +
          "Google Wallet del cliente se actualiza solo: no hay nada más que llamar.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["ref", "referencia"],
                additionalProperties: false,
                properties: {
                  ref: { type: "string", pattern: "^mb_[0-9A-HJKMNP-TV-Z]{16}$" },
                  monto: {
                    type: ["integer", "null"],
                    minimum: 0,
                    maximum: 10000000,
                    description: "Colones enteros. Omitilo en una tarjeta de sellos pura.",
                  },
                  referencia: {
                    type: "string",
                    minLength: 3,
                    maxLength: 96,
                    description: "El número de tiquete. Uno distinto por cada cobro.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Se acreditó." },
          "200": { description: "Reintento idempotente: `duplicada: true`." },
          "409": RESPUESTA_ERROR,
          "422": RESPUESTA_ERROR,
          "429": RESPUESTA_ERROR,
        },
      },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json(DOCUMENTO, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
