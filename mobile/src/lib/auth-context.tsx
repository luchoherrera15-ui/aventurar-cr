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
    /**
     * ⚠️ EL `catch` NO ES DE TRÁMITE: SIN ÉL, EL APP SE QUEDA GIRANDO.
     *
     * `cargandoSesion` arranca en `true` y la pantalla de Perfil pinta
     * una ruedita mientras lo esté. Si esta promesa RECHAZA —el
     * AsyncStorage corrupto, un token que no se puede parsear, el
     * dispositivo sin espacio— nadie baja esa bandera: la ruedita se
     * queda para siempre y no aparece ni el campo de correo ni el botón
     * de Google.
     *
     * Y el síntoma es exactamente «el app no me deja entrar», sin un
     * solo pedido de red que lo delate en los logs del servidor. Es de
     * los fallos más difíciles de diagnosticar que puede tener un
     * cliente móvil, y se evita con estas tres líneas.
     *
     * Falla ABIERTO, no cerrado: ante el error se asume «no hay sesión»,
     * que deja a la persona en la pantalla de entrar. Asumir lo
     * contrario la dejaría mirando un perfil vacío sin poder salir.
     */
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setCargandoSesion(false);
      })
      .catch(() => {
        setSession(null);
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
