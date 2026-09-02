"use client";

import { useState, useTransition } from "react";
import { guardarFichaCliente } from "./ficha-actions";
import { Card } from "@/components/panel/piezas";
import { BOTON_PANEL_PRIMARIO, CAMPO_PANEL, DETALLE, ROTULO_CAMPO } from "@/components/panel/sistema";

/**
 * LO QUE EL NEGOCIO SABE DEL CLIENTE — la parte editable de la ficha.
 *
 * Notas libres y etiquetas (0228). Es la única pieza de la ficha 360°
 * que escribe: todo lo demás se deriva, y por eso este componente es
 * el único "use client" de la pantalla.
 *
 * Las etiquetas se escriben separadas por coma y se limpian en el
 * servidor: un campo de chips con autocompletar sería más vistoso y
 * más frágil, y la persona que anota «vip, no confirma» en la caja
 * entre dos clientes no necesita vistoso — necesita rápido.
 */
export default function FichaNotas({
  negocioId,
  clave,
  notasIniciales,
  etiquetasIniciales,
}: {
  negocioId: string;
  clave: string;
  notasIniciales: string;
  etiquetasIniciales: string[];
}) {
  const [notas, setNotas] = useState(notasIniciales);
  const [etiquetas, setEtiquetas] = useState(etiquetasIniciales.join(", "));
  const [estado, setEstado] = useState<"quieto" | "guardado" | "error">("quieto");
  const [motivo, setMotivo] = useState("");
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    setEstado("quieto");
    iniciar(async () => {
      const res = await guardarFichaCliente({
        ranchoId: negocioId,
        clave,
        notas,
        etiquetas: etiquetas.split(","),
      });
      if (res.ok) {
        setEstado("guardado");
      } else {
        setEstado("error");
        setMotivo(res.motivo);
      }
    });
  }

  return (
    <Card titulo="Tus notas">
      <label className={ROTULO_CAMPO} htmlFor="ficha-etiquetas">
        Etiquetas (separadas por coma)
      </label>
      <input
        id="ficha-etiquetas"
        value={etiquetas}
        onChange={(e) => {
          setEtiquetas(e.target.value);
          setEstado("quieto");
        }}
        placeholder="vip, no confirma, color 7.1"
        className={CAMPO_PANEL}
      />

      <label className={`${ROTULO_CAMPO} mt-3 block`} htmlFor="ficha-notas">
        Notas
      </label>
      <textarea
        id="ficha-notas"
        value={notas}
        onChange={(e) => {
          setNotas(e.target.value);
          setEstado("quieto");
        }}
        rows={4}
        maxLength={2000}
        placeholder="Alérgica al amoníaco. Prefiere que la atienda Karla."
        className={`${CAMPO_PANEL} resize-none leading-relaxed`}
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente}
          className={BOTON_PANEL_PRIMARIO}
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {estado === "guardado" && (
          <span className="text-[12.5px] font-bold text-aventurea-green">Guardado ✓</span>
        )}
        {estado === "error" && (
          <span role="alert" className="text-[12.5px] font-bold text-red-600">
            {motivo}
          </span>
        )}
      </div>
      <p className={`mt-2 ${DETALLE}`}>
        Esto lo ves solo vos. Las etiquetas también sirven para buscar en la lista de
        clientes.
      </p>
    </Card>
  );
}
