import { describe, expect, it } from "vitest";
import { rutaDeNotificacion } from "./abrir-notificacion";

/**
 * Lo que se prueba acá es la traducción de la URL que manda el
 * servidor, y sobre todo el caso que ya pasó de verdad: una
 * notificación vieja apuntando a una pestaña que se eliminó.
 *
 * Ese fallo no daba error. Llevaba a la pantalla equivocada en
 * silencio, que es peor: nadie reporta un error que no ve.
 */
describe("rutaDeNotificacion", () => {
  it("deja pasar las pestañas que existen", () => {
    expect(rutaDeNotificacion("/?tab=reservas")).toBe("/?tab=reservas");
    expect(rutaDeNotificacion("/?tab=perfil")).toBe("/?tab=perfil");
    expect(rutaDeNotificacion("/?tab=explorar")).toBe("/?tab=explorar");
    expect(rutaDeNotificacion("/?tab=promos")).toBe("/?tab=promos");
  });

  // El caso real: dos pestañas dejaron de existir —Mensajes primero,
  // Favoritos después— pero las notificaciones que ya salieron siguen
  // en el teléfono con esas URLs, y se pueden tocar días más tarde.
  //
  // Ojo con `favoritos`: la SEGUNDA pestaña sigue existiendo, pero
  // ahora muestra Promos, que es otra cosa. Mandar ahí un enlace que
  // decía "tus favoritos" sería llevar a la pantalla equivocada sin
  // que nadie note el error — por eso va a `/favoritos`, la pantalla.
  it("manda a su nueva casa lo que iba a una pestaña que ya no existe", () => {
    expect(rutaDeNotificacion("/?tab=mensajes")).toBe("/mensajes");
    expect(rutaDeNotificacion("/?tab=consultas")).toBe("/consultas");
    expect(rutaDeNotificacion("/?tab=favoritos")).toBe("/favoritos");
  });

  it("cae en la raíz si la pestaña no existe ni se mudó", () => {
    // Antes esto terminaba en la pestaña 0 (Inicio) sin decir nada. La
    // raíz es lo mismo visualmente, pero por una decisión explícita.
    expect(rutaDeNotificacion("/?tab=inventada")).toBe("/");
  });

  it("deja pasar las rutas profundas tal cual", () => {
    expect(rutaDeNotificacion("/negocio/abc-123/citas")).toBe("/negocio/abc-123/citas");
    expect(rutaDeNotificacion("/mensajes/hilo/xyz")).toBe("/mensajes/hilo/xyz");
    expect(rutaDeNotificacion("/rancho/abc-123")).toBe("/rancho/abc-123");
  });

  // La URL llega por la red: es texto de afuera, no un dato de casa.
  it("no navega a nada que se salga de la app", () => {
    expect(rutaDeNotificacion("https://otro-sitio.com")).toBeNull();
    expect(rutaDeNotificacion("//otro-sitio.com")).toBeNull();
    expect(rutaDeNotificacion("javascript:alert(1)")).toBeNull();
    expect(rutaDeNotificacion("bookea://algo")).toBeNull();
  });

  it("aguanta que no venga nada", () => {
    expect(rutaDeNotificacion(undefined)).toBeNull();
    expect(rutaDeNotificacion(null)).toBeNull();
    expect(rutaDeNotificacion(42)).toBeNull();
    expect(rutaDeNotificacion("")).toBeNull();
  });
});
