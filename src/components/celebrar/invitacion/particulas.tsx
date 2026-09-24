import type { Particulas as TipoParticulas } from "@/lib/celebrar/invitacion/esquema";

/**
 * El ambiente vivo: pétalos, destellos, confeti, burbujas, estrellas u
 * hojas en bucle sutil. Puro CSS (transform + opacity), posiciones
 * pseudoaleatorias pero DETERMINISTAS (misma semilla → mismo render en
 * servidor y cliente, sin diferencias de hidratación). Pocas piezas
 * (18 en la portada, 10 en el cierre): rinde en un teléfono medio.
 */
function semilla(n: number) {
  // LCG chiquito: suficiente para repartir partículas, no para nada más.
  let x = (n * 9301 + 49297) % 233280;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

const FORMA: Record<Exclude<TipoParticulas, "ninguna">, { svg: React.ReactNode; clase: string; min: number; max: number }> = {
  petalos: {
    clase: "inv-part-cae",
    min: 10,
    max: 18,
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2c5 4 7 9 5 14-2 4-6 6-10 4-3-2-4-6-2-10C7 6 9 4 12 2z" fill="currentColor" opacity=".75" />
      </svg>
    ),
  },
  hojas: {
    clase: "inv-part-cae",
    min: 12,
    max: 20,
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 21C3 10 10 3 21 3c0 11-7 18-18 18z" fill="currentColor" opacity=".7" />
        <path d="M3 21L21 3" stroke="currentColor" strokeWidth="1" opacity=".5" />
      </svg>
    ),
  },
  confeti: {
    clase: "inv-part-cae",
    min: 6,
    max: 12,
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="9" width="16" height="6" rx="1" fill="currentColor" opacity=".85" transform="rotate(-20 12 12)" />
      </svg>
    ),
  },
  destellos: {
    clase: "inv-part-brilla",
    min: 6,
    max: 14,
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 1l2 8 8 3-8 3-2 8-2-8-8-3 8-3z" fill="currentColor" />
      </svg>
    ),
  },
  estrellas: {
    clase: "inv-part-brilla",
    min: 5,
    max: 11,
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.5l7.1-.6z" fill="currentColor" />
      </svg>
    ),
  },
  burbujas: {
    clase: "inv-part-sube",
    min: 8,
    max: 22,
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
        <circle cx="8.5" cy="8.5" r="2" fill="currentColor" opacity=".6" />
      </svg>
    ),
  },
  // Las velas del gran comedor: flotan en su lugar, con la llama viva.
  velas: {
    clase: "inv-part-flota",
    min: 14,
    max: 24,
    svg: (
      <svg viewBox="0 0 24 48" aria-hidden="true">
        <ellipse className="inv-vela-halo" cx="12" cy="9" rx="9" ry="9" fill="#ffd27a" opacity=".28" />
        <path className="inv-vela-llama" d="M12 3c2.6 3.2 3.4 5.4 3 7.4-.4 1.7-1.6 2.6-3 2.6s-2.6-.9-3-2.6C8.6 8.4 9.4 6.2 12 3z" fill="#ffcf5a" />
        <path d="M12 7.6c1 1.3 1.3 2.3 1.1 3-.2.6-.6.9-1.1.9s-.9-.3-1.1-.9c-.2-.7.1-1.7 1.1-3z" fill="#fff6d6" />
        <path d="M12 13v2" stroke="#3a2c1a" strokeWidth="1" />
        <rect x="7.5" y="15" width="9" height="30" rx="1.6" fill="#f6ecd4" />
        <path d="M7.5 18c2 1.4 4.4-.6 9 .6" stroke="#e2d2ad" strokeWidth="1.2" fill="none" />
      </svg>
    ),
  },
  banderines: {
    clase: "inv-part-cae",
    min: 14,
    max: 22,
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 2v21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="5" y="3" width="16" height="11" fill="#ffffff" stroke="currentColor" strokeWidth=".8" />
        <path d="M5 3h4v3.7H5zM13 3h4v3.7h-4zM9 6.7h4v3.6H9zM17 6.7h4v3.6h-4zM5 10.3h4V14H5zM13 10.3h4V14h-4z" fill="#1a1a1a" />
      </svg>
    ),
  },
  polvo_hada: {
    clase: "inv-part-sube inv-part-hada",
    min: 5,
    max: 13,
    svg: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" fill="currentColor" opacity=".22" />
        <path d="M12 3l1.6 6.4L20 12l-6.4 1.6L12 21l-1.6-7.4L4 12l6.4-2.6z" fill="currentColor" />
        <circle cx="12" cy="12" r="1.8" fill="#ffffff" />
      </svg>
    ),
  },
};

export default function Particulas({ tipo, cantidad, semilla: base = 1 }: { tipo: TipoParticulas; cantidad: number; semilla?: number }) {
  if (tipo === "ninguna") return null;
  const f = FORMA[tipo];
  const r = semilla(base);
  const piezas = Array.from({ length: cantidad }, (_, i) => {
    const s = Math.round(f.min + r() * (f.max - f.min));
    return {
      i,
      x: `${Math.round(r() * 100)}%`,
      y: `${Math.round(8 + r() * 84)}%`,
      s: `${s}px`,
      t: `${(9 + r() * 10).toFixed(1)}s`,
      d: `${(-r() * 14).toFixed(1)}s`,
      dx: `${Math.round((r() - 0.5) * 120)}px`,
    };
  });
  return (
    <div className="inv-particulas" aria-hidden="true">
      {piezas.map((p) => (
        <span
          key={p.i}
          className={`inv-part ${f.clase}`}
          style={{ "--x": p.x, "--y": p.y, "--s": p.s, "--t": p.t, "--d": p.d, "--dx": p.dx } as React.CSSProperties}
        >
          {f.svg}
        </span>
      ))}
    </div>
  );
}
