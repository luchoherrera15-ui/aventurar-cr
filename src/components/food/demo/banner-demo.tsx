"use client";

import { useRouter } from "next/navigation";
import { reiniciarDemo } from "@/lib/food/demo/estado";

/**
 * La barra "Modo demo" de la vitrina comercial — elegante y discreta
 * (navy, una línea), NO la caja ámbar del showcase viejo: acá el
 * público es un dueño de restaurante en una reunión de venta y la
 * barra no puede verse como una advertencia de error. "Reiniciar"
 * borra favoritos y reservas de la sesión (el "reset demo").
 */
export default function BannerDemo() {
  const router = useRouter();
  return (
    <div className="border-b border-white/10 bg-aventurea-navy px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[12px] font-bold text-white/85">
          <span className="mr-2 rounded-md bg-aventurea-orange px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-white">
            Modo demo
          </span>
          Estás explorando una versión demostrativa de FOOD.BOOKEA · 45 restaurantes de demostración
        </p>
        <button
          type="button"
          onClick={() => {
            reiniciarDemo();
            router.push("/food/demo");
          }}
          className="shrink-0 text-[11.5px] font-bold text-white/60 transition-colors hover:text-white"
        >
          Reiniciar demo
        </button>
      </div>
    </div>
  );
}
