
-- ============================================================
-- REGULARIZAR LAS AFILIACIONES QUE QUEDARON SIN DATOS
--
-- ⚠️  ESTO LO PEGA EL DUEÑO A MANO en el SQL Editor de Supabase.
--     Ningún agente corrió una sola de estas líneas contra producción.
--
-- ⚠️  ARRANCA CON UNA LÍNEA EN BLANCO A PROPÓSITO: el editor de
--     Supabase se come el primer carácter del texto pegado, y ya rompió
--     dos pegados antes. No borres el renglón vacío de arriba.
--
-- ------------------------------------------------------------
-- QUÉ PASÓ
-- ------------------------------------------------------------
-- Los botones de Wallet (`/api/pases/…` y `/api/pases-google/…`)
-- afiliaban directo: insertaban en `miembros` sin escribir la fila de
-- `personas_negocio` —que es EL permiso del negocio para ver a esa
-- persona (0138)— ni la de `consentimientos_persona` —el respaldo que
-- exige la Ley 8968—. Y con la sesión anónima del chat flotante encima,
-- la página de la tarjeta ni siquiera mostraba el formulario, así que a
-- esa gente NUNCA se le preguntó nada: quedó sin nombre, sin correo y
-- sin teléfono.
--
-- Medido en producción: de 5 miembros, 3 sin vínculo y sin
-- consentimiento. Y 13 usuarios anónimos en `auth.users` (correo
-- vacío), que son los del chat.
--
-- El agujero YA ESTÁ CERRADO en el código (las tres puertas comprueban
-- la afiliación completa antes de emitir) y en la base (el trigger
-- `miembros_zexigir_respaldo` de la 0181). Este archivo es solo para
-- las filas que quedaron de antes.
--
-- ------------------------------------------------------------
-- POR QUÉ ACÁ NO HAY UN `update` QUE LO ARREGLE TODO
-- ------------------------------------------------------------
-- Porque no se puede. El nombre y el contacto de esas personas NO
-- EXISTEN EN NINGUNA PARTE: nunca se los pidió nadie. Un SQL que
-- inventara un consentimiento a nombre de alguien a quien jamás se le
-- preguntó sería exactamente el problema que esto viene a arreglar,
-- pero con mejor letra.
--
-- El camino que sí funciona es el del panel: la próxima vez que esa
-- persona venga, el cajero le pregunta y toca «Completar datos» en su
-- ficha. Eso escribe las cuatro cosas (persona, ficha, vínculo y
-- consentimiento con `origen='mostrador'` y su propio texto, que dice
-- que los datos los tomó el negocio de viva voz).
--
-- Lo que sí va acá: VER quiénes son, y una salida de emergencia para el
-- caso en que el dueño ya tenga los datos por otro lado.
-- ============================================================


-- ------------------------------------------------------------
-- 1. QUIÉNES SON  (solo lectura — corré esto primero)
--
-- La vista la crea la 0181. Si todavía no pegaste esa migración, pegala
-- antes: sin ella esta consulta falla con «relation does not exist».
-- ------------------------------------------------------------

select
  miembro_id,
  rancho_id,
  afiliado_en,
  nombre_persona,
  tiene_contacto,
  tiene_vinculo,
  tiene_consentimiento,
  saldo
from public.vista_afiliaciones_incompletas
where nombre_persona is null
   or tiene_contacto = false
   or tiene_vinculo = false
   or tiene_consentimiento = false
order by afiliado_en desc;

-- Leé la columna `saldo` antes de tocar nada: dice cuántos sellos se le
-- quitarían a esa persona si a alguien se le ocurriera borrarla. Este
-- proyecto ya decidió que a nadie se le quitan los sellos que ganó.


-- ------------------------------------------------------------
-- 2. LOS ANÓNIMOS DEL CHAT  (solo lectura)
--
-- Los 13 `auth.users` con correo vacío son del chat flotante y son
-- legítimos: esa gente escribió al negocio sin registrarse. NO se
-- borran. Lo que hay que mirar es si alguno terminó colgado de una
-- persona de lealtad, que es el cruce que causó todo esto.
-- ------------------------------------------------------------

select
  u.id            as usuario_anonimo,
  u.created_at    as sesion_creada,
  p.id            as persona_id,
  p.nombre,
  p.correo,
  p.telefono,
  (select count(*) from public.miembros m where m.persona_id = p.id) as membresias
from auth.users u
join public.personas p on p.cliente_id = u.id
where coalesce(u.email, '') = ''
order by u.created_at desc;


-- ------------------------------------------------------------
-- 3. SALIDA DE EMERGENCIA  (esto SÍ escribe — leelo entero antes)
--
-- Usalo SOLO si ya tenés los datos de esa persona por fuera del sistema
-- y le preguntaste de verdad. Si no, cerrá este archivo y usá
-- «Completar datos» en el panel, que hace lo mismo pero deja el rastro
-- correcto y no se equivoca de columnas.
--
-- Está comentado a propósito: hay que descomentarlo y cambiar los
-- valores a mano, de a una persona por vez. Un `update` masivo acá es
-- exactamente lo que no querés.
--
-- OJO CON LOS ÚNICOS: `personas.correo` y `personas.telefono` son
-- llaves únicas globales (0138). Si el dato que vas a escribir ya es de
-- OTRA persona, el update revienta — y eso está bien, porque escribirlo
-- igual habría fusionado dos identidades con sellos, y eso no se
-- deshace.
-- ------------------------------------------------------------

-- do $$
-- declare
--   -- ── CAMBIÁ ESTOS CINCO VALORES ─────────────────────────────
--   v_miembro   uuid := '00000000-0000-0000-0000-000000000000';
--   v_nombre    text := 'Melissa Rodríguez';
--   v_correo    text := null;          -- o 'melissa@ejemplo.com'
--   v_telefono  text := '88887777';    -- o null
--   v_acepta    boolean := false;      -- ¿le preguntaste y dijo que sí?
--   -- ───────────────────────────────────────────────────────────
--   v_persona uuid;
--   v_rancho  uuid;
--   v_cuenta  uuid;
--   v_negocio text;
--   v_texto   text;
-- begin
--   select m.persona_id, pl.rancho_id, pl.cuenta_id
--     into v_persona, v_rancho, v_cuenta
--     from miembros m
--     join programa_lealtad pl on pl.id = m.programa_id
--    where m.id = v_miembro;
--
--   if v_persona is null then
--     raise exception 'Ese miembro no existe o no tiene persona_id';
--   end if;
--
--   select coalesce(r.nombre, 'este negocio') into v_negocio
--     from ranchos r where r.id = v_rancho;
--
--   -- El MISMO texto que escribe el panel (`textoConsentimientoMostrador`
--   -- en src/lib/lealtad/personas.ts). Si lo cambiás acá y no allá, la
--   -- tabla queda con dos pruebas que dicen cosas distintas para el
--   -- mismo hecho.
--   v_texto := 'Los datos de esta persona los tomó ' || v_negocio ||
--              ' en el mostrador y le preguntó de viva voz si quiere que le ' ||
--              'avisen por WhatsApp o correo de sus promociones y de los premios ' ||
--              'que va juntando. Se puede salir cuando quiera.';
--
--   -- a) La identidad raíz: SOLO lo que esté en null, nunca se pisa.
--   update personas
--      set nombre   = coalesce(nullif(btrim(nombre), ''), v_nombre),
--          correo   = coalesce(correo, public.normalizar_correo(v_correo)),
--          telefono = coalesce(telefono, public.normalizar_telefono(v_telefono))
--    where id = v_persona;
--
--   -- b) El vínculo: EL permiso del negocio para ver a esta persona.
--   insert into personas_negocio (persona_id, cuenta_id, rancho_id, origen)
--   values (v_persona, v_cuenta, v_rancho, 'mostrador')
--   on conflict do nothing;
--
--   -- c) El respaldo, una fila por canal — el «no acepto» también, que
--   --    es lo que prueba que se preguntó.
--   insert into consentimientos_persona
--     (persona_id, ambito, cuenta_id, rancho_id, canal, estado,
--      correo, telefono, texto_version, texto_exacto, origen)
--   select v_persona, 'negocio', v_cuenta, v_rancho, c,
--          case when v_acepta then 'aceptado' else 'revocado' end,
--          public.normalizar_correo(v_correo),
--          public.normalizar_telefono(v_telefono),
--          'mostrador-v1', v_texto, 'mostrador'
--     from unnest(array['whatsapp', 'correo']) as c;
--
--   raise notice 'Persona % regularizada para el negocio %', v_persona, v_rancho;
-- end $$;


-- ------------------------------------------------------------
-- 4. COMPROBAR  (volvé a correr el bloque 1)
--
-- Cuando la consulta del bloque 1 devuelva CERO filas, no queda ninguna
-- persona con sellos de la que no se sepa quién es. Ese es el final.
-- ------------------------------------------------------------
