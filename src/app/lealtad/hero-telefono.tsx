import "./hero-pase.css";
import { PaseWallet } from "./pase-wallet";

/**
 * El teléfono protagonista del hero: el pase de Apple Wallet
 * consiguiendo un sello en vivo, con el pase de Google Wallet
 * asomando detrás — porque el pase existe en los dos, no solo en uno.
 * Autónomo y sin JavaScript, misma técnica que Reel.tsx.
 */

function Check({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconQR({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <path d="M14 14h3v3h-3zM20 14v3M17 20h4" />
    </svg>
  );
}

/** Los avisos que caen alrededor del teléfono: el negocio GANANDO
 *  clientes en vivo — la promesa del titular, dibujada. */
const AVISOS = [
  { texto: "María se afilió con el QR", chip: "+1 cliente" },
  { texto: "José sumó su sello — va 7/10", chip: "volvió" },
  { texto: "Ana canjeó su premio y reservó otra vez", chip: "canje" },
];

export default function HeroTelefono() {
  return (
    <div
      aria-hidden
      style={{ "--hero-dur": "7s" } as React.CSSProperties}
      className="relative mx-auto flex w-fit items-center justify-center"
    >
      {/* El contador que sube: la promesa del titular en un número. */}
      <div
        // Solo desde lg: entre 768 y 1023px los desplazamientos aún son
        // chicos y esta tarjeta se montaba ENCIMA del teléfono, tapando
        // justo la animación que vende la landing.
        className="absolute top-2 z-10 hidden w-[168px] rounded-2xl border p-3.5 text-left lg:-left-40 lg:block"
        style={{ background: "rgba(10,18,38,.92)", borderColor: "rgba(255,255,255,.14)" }}
      >
        <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/45">
          Clientes este mes
        </p>
        <div className="relative mt-1 h-[30px]">
          {[47, 48, 49].map((n, i) => (
            <span
              key={n}
              className="anim-hero-cifra absolute left-0 top-0 text-[26px] font-extrabold leading-none text-white"
              style={{ "--cifra-delay": `${(i * 7) / 3}s` } as React.CSSProperties}
            >
              {n}
              <span className="ml-1.5 text-[11px] font-bold text-[#7de3a8]">
                ▲ {i + 5} esta semana
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Los avisos cayendo a la derecha, uno por tercio del ciclo. */}
      <div className="absolute bottom-10 z-10 hidden w-[220px] flex-col gap-2 text-left lg:-right-48 lg:flex">
        {AVISOS.map((a, i) => (
          <div
            key={a.texto}
            className="anim-hero-chip flex items-start gap-2 rounded-xl border px-3 py-2.5"
            style={
              {
                background: "rgba(10,18,38,.92)",
                borderColor: "rgba(255,255,255,.14)",
                "--chip-delay": `${(i * 7) / 3}s`,
              } as React.CSSProperties
            }
          >
            <span
              className="mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
              style={{ background: "rgba(238,116,32,.2)", color: "#ee7420" }}
            >
              {a.chip}
            </span>
            <span className="text-[11.5px] font-bold leading-snug text-white/85">{a.texto}</span>
          </div>
        ))}
      </div>

      {/* El pase de Google Wallet, asomando detrás — quieto, apenas
          girado, como cuando Wallet apila más de un pase. */}
      <div
        className="absolute -right-8 top-6 w-[196px] -rotate-[9deg] opacity-90 sm:-right-10 sm:top-7 sm:w-[210px]"
        style={{ filter: "brightness(.94)" }}
      >
        <PaseWallet
          marca="google"
          negocio="Café La Esquina"
          etiquetaCampo="Sellos"
          valorCampo="6/10"
          colorFondo="#f4f1ea"
          serial="BK · 5510 8842"
        >
          <div className="grid grid-cols-5 gap-1.5 pb-1">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className="flex aspect-square items-center justify-center rounded-full"
                style={
                  i < 6
                    ? { background: "#ee7420", color: "#fff" }
                    : { border: "2px dashed rgba(20,21,26,.22)" }
                }
              >
                {i < 6 && <Check className="h-2.5 w-2.5" />}
              </span>
            ))}
          </div>
        </PaseWallet>
      </div>

      {/* El teléfono con el pase de Apple Wallet, adelante. */}
      <div
        className="anim-hero-pulso relative h-[440px] w-[254px] rounded-[42px] p-[9px] sm:h-[478px] sm:w-[272px]"
        style={{
          background: "#050810",
          boxShadow:
            "0 0 0 2px #1c2436, 0 0 0 3.5px #2e3a52, 0 60px 120px -35px rgba(0,0,0,.9)",
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-[34px]"
          style={{ background: "#0a1226" }}
        >
          <div
            className="absolute left-1/2 top-2 z-10 h-[15px] w-[76px] -translate-x-1/2 rounded-xl"
            style={{ background: "#050810" }}
          />

          <div className="flex h-full flex-col justify-center px-4 pb-6 pt-11">
            <div className="relative h-[30px] shrink-0">
              <div
                className="anim-hero-tap absolute inset-x-0 top-0 flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 opacity-0"
                style={{ background: "rgba(255,255,255,.08)" }}
              >
                <span className="relative flex h-4 w-4 items-center justify-center">
                  <span
                    className="anim-hero-ping absolute h-3 w-3 rounded-full"
                    style={{ background: "rgba(238,116,32,.55)" }}
                  />
                  <IconQR className="relative h-3.5 w-3.5 text-[#ee7420]" />
                </span>
                <span className="text-[10px] font-bold text-white/80">Sumando tu sello…</span>
              </div>
            </div>

            <div className="mt-2">
              <PaseWallet marca="apple" negocio="Café La Esquina" etiquetaCampo="Sellos" valorCampo="7/10">
                <div className="grid grid-cols-5 gap-2 pb-1">
                  {Array.from({ length: 6 }, (_, i) => (
                    <span
                      key={i}
                      className="flex aspect-square items-center justify-center rounded-full text-white"
                      style={{ background: "#ee7420" }}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  ))}
                  <span className="relative aspect-square">
                    <span
                      className="absolute inset-0 rounded-full border-2 border-dashed"
                      style={{ borderColor: "rgba(255,255,255,.32)" }}
                    />
                    <span
                      className="anim-hero-pop absolute inset-0 flex items-center justify-center rounded-full text-white"
                      style={{ background: "#ee7420" }}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  </span>
                  {Array.from({ length: 3 }, (_, i) => (
                    <span
                      key={`vacio-${i}`}
                      className="aspect-square rounded-full border-2 border-dashed"
                      style={{ borderColor: "rgba(255,255,255,.22)" }}
                    />
                  ))}
                </div>
              </PaseWallet>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
