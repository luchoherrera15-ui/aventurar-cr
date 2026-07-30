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
import { registrarPush } from "./push";

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
  /** Vuelve a leer el perfil (después de cambiar el nombre, p. ej.). */
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
  // Se incrementa para forzar la relectura del perfil.
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
  }, [session, recarga]);

  // Con sesión, el teléfono queda registrado para notificaciones push
  // (reservas, citas y mensajes). registrarPush degrada solo: en Expo
  // Go o sin proyecto EAS simplemente no hace nada.
  useEffect(() => {
    if (session) void registrarPush(session.user.id);
  }, [session]);

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
