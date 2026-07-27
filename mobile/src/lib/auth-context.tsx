import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Perfil = {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: "admin" | "dueno_rancho" | "cliente";
};

type AuthState = {
  session: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
};

const AuthContext = createContext<AuthState>({
  session: null,
  perfil: null,
  cargando: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargandoSesion(false);
    });

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
    });

    return () => suscripcion.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el perfil cuando la sesión desaparece (logout)
      setPerfil(null);
      return;
    }
    let vigente = true;
    setCargandoPerfil(true);
    supabase
      .from("perfiles")
      .select("id, email, nombre, rol")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!vigente) return;
        setPerfil(data as Perfil | null);
        setCargandoPerfil(false);
      });
    return () => {
      vigente = false;
    };
  }, [session]);

  const valor = useMemo(
    () => ({ session, perfil, cargando: cargandoSesion || (!!session && cargandoPerfil) }),
    [session, perfil, cargandoSesion, cargandoPerfil],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
