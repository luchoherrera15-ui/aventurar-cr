import { describe, expect, it } from "vitest";
import {
  armarPrimerMensaje,
  CIERRE_CONSULTA,
  DURACION_SUPUESTA_MINUTOS,
  duracionAgenda,
  etiquetaDuracion,
  finDeEvento,
  horarioDeEventos,
  INTERVALO_MINUTOS,
  minutosDeItem,
  ULTIMO_ARRANQUE,
} from "./agenda-consulta";
import { calcularDisponibilidad } from "@/lib/agenda/disponibilidad";
import { horaAMinutos } from "@/app/citas/tipos";
import { leerConfigCobro } from "@/lib/cotizador-servicio";
import type { RanchoItem } from "@/app/mi-negocio/types";
import { fmtColones } from "@/lib/finanzas";

/**
 * Lo que se prueba acá es el ARMADOR DEL PRIMER MENSAJE y el puente
 * cotizador → motor. Es la parte que el proveedor lee en su chat: si
 * dice "reserva" donde no hay reserva, o se le come el aviso de que
 * nada quedó apartado, el negocio pierde una fecha por un malentendido.
 */

let contador = 0;
function item(overrides: Partial<RanchoItem> = {}): RanchoItem {
  contador += 1;
  return {
    id: `i${contador}`,
    rancho_id: "r1",
    nombre: `Ítem ${contador}`,
    descripcion: null,
    precio: 10000,
    unidad: null,
    activo: true,
    orden: contador,
    foto_url: null,
    duracion_horas: null,
    duracion_minutos: null,
    grupo: null,
    tipo: "paquete",
    min_por_reserva: 1,
    max_por_reserva: null,
    capacidad_dia: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("etiquetaDuracion", () => {
  it("escribe las horas en palabras, no en abreviatura", () => {
    expect(etiquetaDuracion(240)).toBe("4 horas");
    expect(etiquetaDuracion(60)).toBe("1 hora");
    expect(etiquetaDuracion(90)).toBe("1 hora 30 min");
    expect(etiquetaDuracion(45)).toBe("45 min");
  });
});

describe("finDeEvento", () => {
  it("suma la duración a la hora de arranque", () => {
    expect(finDeEvento("15:00", 240)).toEqual({ hora: "19:00", diaSiguiente: false });
  });

  it("un evento que pasa la medianoche lo dice (el DJ de la boda)", () => {
    expect(finDeEvento("21:00", 300)).toEqual({ hora: "02:00", diaSiguiente: true });
  });
});

describe("duracionAgenda", () => {
  const vacio = { items: [] as RanchoItem[], cantidades: {} as Record<string, number> };

  it("por_hora: las horas del stepper × 60", () => {
    const config = leerConfigCobro({ modalidad_cobro: "por_hora", tarifa_hora: 25000 });
    expect(duracionAgenda({ config, seleccion: { horas: 4 }, ...vacio })).toEqual({
      minutos: 240,
      supuesta: false,
    });
  });

  it("por_evento: las horas incluidas más las extra", () => {
    const config = leerConfigCobro({
      modalidad_cobro: "por_evento",
      tarifa_evento: 150000,
      duracion_horas: 3,
      hora_extra: 20000,
    });
    expect(duracionAgenda({ config, seleccion: { horasExtra: 2 }, ...vacio })).toEqual({
      minutos: 300,
      supuesta: false,
    });
  });

  it("por_persona sin nada elegido: cae en el bloque supuesto y lo avisa", () => {
    const config = leerConfigCobro({ modalidad_cobro: "por_persona", tarifa_persona: 6000 });
    expect(duracionAgenda({ config, seleccion: { invitados: 80 }, ...vacio })).toEqual({
      minutos: DURACION_SUPUESTA_MINUTOS,
      supuesta: true,
    });
  });

  it("por_persona con un paquete del catálogo: manda la duración del paquete", () => {
    const config = leerConfigCobro({ modalidad_cobro: "por_persona", tarifa_persona: 6000 });
    const corto = item({ duracion_horas: 2 });
    const largo = item({ duracion_horas: 5 });
    expect(
      duracionAgenda({
        config,
        seleccion: { invitados: 80 },
        items: [corto, largo],
        // Con dos paquetes en el pedido manda el más largo: el evento
        // no termina hasta que termina el último.
        cantidades: { [corto.id]: 1, [largo.id]: 1 },
      }),
    ).toEqual({ minutos: 300, supuesta: false });
  });

  it("un ítem no elegido no aporta su duración", () => {
    const config = leerConfigCobro({ modalidad_cobro: "por_unidad" });
    const paquete = item({ duracion_horas: 8 });
    expect(
      duracionAgenda({ config, seleccion: {}, items: [paquete], cantidades: {} }),
    ).toEqual({ minutos: DURACION_SUPUESTA_MINUTOS, supuesta: true });
  });
});

describe("minutosDeItem", () => {
  it("prefiere los minutos explícitos sobre las horas", () => {
    expect(minutosDeItem({ duracion_minutos: 45, duracion_horas: 3 })).toBe(45);
    expect(minutosDeItem({ duracion_minutos: null, duracion_horas: 2.5 })).toBe(150);
    expect(minutosDeItem({ duracion_minutos: null, duracion_horas: null })).toBeNull();
  });
});

describe("horarioDeEventos", () => {
  it("abre los siete días (el proveedor de eventos no publica horario)", () => {
    const horario = horarioDeEventos(120);
    expect(Object.keys(horario).sort()).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
  });

  it("el cierre es el último arranque MÁS la duración, no un cierre de local", () => {
    // 22:00 + 5 h = "27:00" — las 3 a. m. del día siguiente, escrito
    // como minutos desde la medianoche de ESTE día.
    expect(horarioDeEventos(300)["0"]).toEqual({ abre: "08:00", cierra: "27:00" });
    expect(horaAMinutos("27:00")).toBe(horaAMinutos(ULTIMO_ARRANQUE) + 300);
  });

  it("el motor sigue ofreciendo las 22:00 aunque el evento dure 5 horas", () => {
    // Esta es LA razón de existir de horarioDeEventos: con un horario
    // normal (cierre a las 22:00) el motor no ofrecería ni las 18:00
    // para un servicio de 5 horas, y una discomóvil de boda se
    // quedaría sin poder consultar su horario natural.
    const { cualquiera } = calcularDisponibilidad({
      fecha: "2026-03-21",
      zonaHoraria: "America/Costa_Rica",
      horarioNegocio: horarioDeEventos(300),
      recursos: [],
      duracionMinutos: 300,
      citas: [],
      bloqueos: [],
      intervaloMinutos: INTERVALO_MINUTOS,
    });
    expect(cualquiera[0]).toBe("08:00");
    expect(cualquiera.at(-1)).toBe("22:00");
  });

  it("una reserva ya confirmada tapa las horas que se le montan encima", () => {
    const { cualquiera } = calcularDisponibilidad({
      fecha: "2026-03-21",
      zonaHoraria: "America/Costa_Rica",
      horarioNegocio: horarioDeEventos(120),
      recursos: [],
      duracionMinutos: 120,
      // Un evento del proveedor de 15:00 a 18:00.
      citas: [{ miembroId: null, horaInicio: "15:00", duracionMinutos: 180 }],
      bloqueos: [],
      intervaloMinutos: INTERVALO_MINUTOS,
    });
    expect(cualquiera).not.toContain("15:00");
    expect(cualquiera).not.toContain("17:00");
    expect(cualquiera).toContain("13:00");
    expect(cualquiera).toContain("18:00");
  });
});

describe("armarPrimerMensaje", () => {
  const base = {
    fecha: "2026-03-21",
    hora: "15:00",
    duracionMinutos: 240,
    duracionSupuesta: false,
  };

  it("abre con la fecha y el rango de horas en palabras, sin punto de más", () => {
    const texto = armarPrimerMensaje(base);
    expect(texto).toContain(
      "Hola, quiero consultar disponibilidad para el sábado 21 de marzo de 2026 " +
        "de 3:00 p. m. a 7:00 p. m.\n",
    );
    expect(texto).toContain("Duración: 4 horas.\n");
    expect(texto).not.toContain("..");
  });

  it("NUNCA habla de reservar: cierra diciendo que no se apartó nada", () => {
    const texto = armarPrimerMensaje(base);
    expect(texto.endsWith(CIERRE_CONSULTA)).toBe(true);
    // El cuerpo se mira aparte: la ÚNICA vez que aparece la palabra
    // "reservado" es en la línea de cierre, y ahí va negada.
    const cuerpo = texto.slice(0, -CIERRE_CONSULTA.length).toLowerCase();
    expect(cuerpo).not.toContain("reserv");
    expect(cuerpo).not.toContain("depósito");
    expect(cuerpo).not.toContain("comprobante");
    expect(cuerpo).not.toContain("aprobación");
  });

  it("marca la duración como aproximada cuando la supuso la página", () => {
    const texto = armarPrimerMensaje({ ...base, duracionSupuesta: true });
    expect(texto).toContain("Duración aproximada (a confirmar): 4 horas");
  });

  it("avisa cuando el evento termina de madrugada", () => {
    const texto = armarPrimerMensaje({ ...base, hora: "21:00", duracionMinutos: 300 });
    expect(texto).toContain("de 9:00 p. m. a 2:00 a. m. del día siguiente.");
  });

  it("arma el resumen completo: cotización, pedido y total", () => {
    const texto = armarPrimerMensaje({
      ...base,
      tipoEvento: "Cumpleaños",
      invitados: 80,
      paqueteBase: "Estación 1",
      elecciones: ["Tres leches", " Brownies "],
      lineasServicio: [
        { etiqueta: "₡25.000 × 4 horas", monto: 100000 },
        { etiqueta: "Traslado", monto: 15000 },
      ],
      pedido: [
        { nombre: "Mesa de dulces", cantidad: 2, precio: 35000, unidad: "c/u" },
        { nombre: "Arco de globos", cantidad: 1, precio: null, unidad: null },
      ],
      hayACotizar: true,
      notas: "El evento es en Santa Ana, al aire libre.",
    });

    expect(texto).toContain("Tipo de evento: Cumpleaños.");
    expect(texto).toContain("Invitados: 80.");
    expect(texto).toContain("Paquete elegido: Estación 1 — sustituye la tarifa base.");
    expect(texto).toContain(
      "Elecciones incluidas en la tarifa (sin costo): Tres leches, Brownies.",
    );
    // Los montos se comparan con el MISMO formateador del sitio: el
    // separador de miles de es-CR lo pone el ICU del entorno, y
    // clavarlo a mano hacía fallar el test sin que nada estuviera mal.
    expect(texto).toContain(`• ₡25.000 × 4 horas: ${fmtColones(100000)}`);
    expect(texto).toContain(`Estimado del servicio: ${fmtColones(115000)}.`);
    expect(texto).toContain(`• 2× Mesa de dulces (${fmtColones(35000)} c/u)`);
    expect(texto).toContain("• 1× Arco de globos (a cotizar)");
    expect(texto).toContain(
      `Total estimado (servicio + pedido): ${fmtColones(185000)} — sin contar lo que se cotiza aparte.`,
    );
    expect(texto).toContain("Notas: El evento es en Santa Ana, al aire libre.");
  });

  it("sin pedido no dice 'servicio + pedido'", () => {
    const texto = armarPrimerMensaje({
      ...base,
      lineasServicio: [{ etiqueta: "₡25.000 × 4 horas", monto: 100000 }],
    });
    expect(texto).toContain(`Total estimado: ${fmtColones(100000)}.`);
  });

  it("las líneas vacías no ensucian el mensaje", () => {
    const texto = armarPrimerMensaje({
      ...base,
      tipoEvento: "   ",
      invitados: 0,
      elecciones: ["  "],
      pedido: [{ nombre: "Fantasma", cantidad: 0, precio: 1000, unidad: null }],
      notas: "  ",
    });
    expect(texto).not.toContain("Tipo de evento");
    expect(texto).not.toContain("Invitados");
    expect(texto).not.toContain("Elecciones");
    expect(texto).not.toContain("Pedido:");
    expect(texto).not.toContain("Notas:");
  });

  it("dice el rango del alquiler de varios días", () => {
    const texto = armarPrimerMensaje({ ...base, fechaFin: "2026-03-23" });
    expect(texto).toContain(
      "Alquiler del sábado 21 de marzo de 2026 al lunes 23 de marzo de 2026.",
    );
  });

  it("respeta el tope de 2000 de la columna sin comerse el cierre", () => {
    const texto = armarPrimerMensaje({ ...base, notas: "x".repeat(4000) });
    expect(texto.length).toBeLessThanOrEqual(2000);
    expect(texto.endsWith(CIERRE_CONSULTA)).toBe(true);
  });
});
