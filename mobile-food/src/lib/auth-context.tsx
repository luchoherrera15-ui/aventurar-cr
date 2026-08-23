import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Mismo patrón que mobile/src/lib/auth-context.tsx (Bookea): misma
 * base de Supabase, mismo `perfiles`, sesión persistida en
 * AsyncStorage. Sin registro de push acá — Food v1 no manda
 * notificaciones todavía (se agrega cuando haga falta, no antes).
 */
export type Perfil = {
  id: string;
  email: string | null;
  nombre: string | null;
};

type AuthState = {
  session: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  refrescarPerfil: () => void;
};

const AuthContext = createContext<AuthState>({
  session: null,
  perfil: null,
  cargando: true,
  refrescarPerfil: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [recarga, setRecarga] = useState(0);

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
      .select("id, email, nombre")
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
  }, [session, recarga]);

  const refrescarPerfil = useCallback(() => setRecarga((n) => n + 1), []);

  const valor = useMemo(
    () => ({
      session,
      perfil,
      cargando: cargandoSesion || (!!session && cargandoPerfil),
      refrescarPerfil,
    }),
    [session, perfil, cargandoSesion, cargandoPerfil, refrescarPerfil],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
