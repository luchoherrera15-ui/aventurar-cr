import { describe, expect, it } from "vitest";
import { sanearHtmlInvitacion } from "./sanear-html";

describe("sanearHtmlInvitacion", () => {
  it("quita los <script> enteros y deja el <style>", () => {
    const html = `<style>.a{color:red}</style><div class="a">Hola</div><script>alert(1)</script>`;
    expect(sanearHtmlInvitacion(html)).toBe(`<style>.a{color:red}</style><div class="a">Hola</div>`);
  });

  it("un <script> escrito DENTRO de un comentario no arrastra el <style> de al lado", () => {
    // El caso real de «Carta de Amor» (demo-boda-premium): la nota
    // técnica del encabezado mencionaba `<script>` como texto y el
    // saneador borraba desde ahí hasta el primer cierre de verdad.
    const html = [
      `<!-- NOTAS: CSS en el <style>, JS en dos <script> inline -->`,
      `<style>.bpr-hero{min-height:100svh}</style>`,
      `<section class="bpr-hero">Isabella & Mateo</section>`,
      `<script>document.body.dataset.x = "1";</script>`,
    ].join("\n");
    const salida = sanearHtmlInvitacion(html);
    expect(salida).toContain(`<style>.bpr-hero{min-height:100svh}</style>`);
    expect(salida).toContain(`<section class="bpr-hero">Isabella & Mateo</section>`);
    expect(salida).not.toContain("<script");
    expect(salida).not.toContain("<!--");
  });

  it("borra los comentarios pero no lo que hay entre dos comentarios", () => {
    const html = `<!-- a --><p>uno</p><!-- b --><p>dos</p>`;
    expect(sanearHtmlInvitacion(html)).toBe(`<p>uno</p><p>dos</p>`);
  });

  it("saca manejadores on* y esquemas javascript:", () => {
    const html = `<a href="javascript:alert(1)" onclick="x()">ir</a><img src="https://x/y.png" onerror="z()">`;
    const salida = sanearHtmlInvitacion(html);
    expect(salida).not.toMatch(/onclick|onerror|javascript:/);
    expect(salida).toContain(`src="https://x/y.png"`);
  });

  it("conserva los ganchos data-bookea que monta React", () => {
    const html = `<button data-bookea="abrir-rsvp">Confirmar</button><span data-bookea="cuenta-regresiva"></span>`;
    expect(sanearHtmlInvitacion(html)).toBe(html);
  });

  it("es idempotente", () => {
    const html = `<!-- x <script> --><style>.a{}</style><p onclick="a()">t</p><script>1</script>`;
    const una = sanearHtmlInvitacion(html);
    expect(sanearHtmlInvitacion(una)).toBe(una);
  });
});
