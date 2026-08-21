-- ============================================================
-- 0199 — UN LINK Y UN QR PROPIOS POR TARJETA
--
-- Pedido del dueño, textual: «al crear otra tarjeta me parece que el
-- link de la primera desaparece, y no puede ser así ya que la primera
-- estaba asociada al QR que el cliente ya tiene expuesto. ¿Podés hacer
-- que cada tarjeta tenga un QR y un link distinto? La idea es poder
-- hacer pósters para cada una independiente y que cada una tenga su
-- función.»
--
-- ------------------------------------------------------------
-- QUÉ ESTABA MAL
-- ------------------------------------------------------------
-- El único link público de Lealtad era `/tarjeta/<slug-del-negocio>`,
-- de cuando la base garantizaba UNA tarjeta por negocio. Desde que la
-- 0134 liberó el `unique(rancho_id)`, ese link tiene que elegir cuál de
-- las tarjetas servir — y elegía «la que emita, desempatando por uuid».
--
-- El uuid de la tarjeta NUEVA puede ordenar antes que el de la vieja.
-- O sea que crear una segunda tarjeta podía cambiar, sin avisar y sin
-- que nadie tocara nada, a qué tarjeta lleva el QR YA IMPRESO Y PEGADO
-- en la pared del local. Pura Matcha tiene hoy dos tarjetas y 31
-- clientes con sellos en la primera.
--
-- ------------------------------------------------------------
-- QUÉ HACE ESTA MIGRACIÓN, Y QUÉ **NO**
-- ------------------------------------------------------------
-- Agrega una sola cosa: `programa_lealtad.slug`, el nombre corto de
-- cada tarjeta dentro de SU negocio. Con eso el link nuevo se lee
-- `bookea.lat/tarjeta/puramatcha/paint-and-matcha` en vez de terminar
-- en un uuid, que en un póster es ilegible y se teclea mal.
--
-- Lo que NO hace, a propósito:
--
--   · NO toca el link viejo. `/tarjeta/<negocio>` sigue existiendo y
--     desde ahora está clavado a la tarjeta MÁS VIEJA del negocio —la
--     única que podía existir cuando se imprimió el póster—. Eso se
--     resuelve en TypeScript (`laDelLinkDelNegocio`), sin datos nuevos:
--     `created_at` ya existe desde la 0060 y no cambia nunca.
--   · NO toca `miembros`, `pases_wallet`, `transacciones_puntos` ni
--     nada del mecanismo de actualización de pases. Ningún cliente
--     pierde un sello por esto.
--   · NO hace obligatoria la columna. Es `null`able y el código sabe
--     derivar el mismo texto del nombre mientras esté vacía — por eso
--     un póster impreso antes de aplicar esto sigue funcionando
--     después (ver `src/lib/lealtad/llave-tarjeta.ts`).
--
-- ------------------------------------------------------------
-- POR QUÉ EL ÚNICO ES POR NEGOCIO Y NO GLOBAL
-- ------------------------------------------------------------
-- Porque el link lleva el negocio adelante. Dos negocios distintos
-- pueden llamarle «Sellos» a su tarjeta sin pisarse, y obligarlos a
-- inventar «sellos-2» sería cobrarle a uno el nombre que eligió otro.
--
-- El único cuelga de `rancho_id` Y de `cuenta_id` (0134: un programa
-- puede colgar de cualquiera de las dos raíces), cada uno parcial, para
-- que las filas sin esa columna no choquen entre sí.
-- ============================================================


-- ------------------------------------------------------------
-- 1. La columna
-- ------------------------------------------------------------

alter table public.programa_lealtad
  add column if not exists slug text;

-- El mismo alfabeto que produce `slugDeNombreDeTarjeta` en TypeScript:
-- minúsculas, números y guiones, sin empezar ni terminar en guion y sin
-- guiones dobles. Si las dos definiciones se separan, el link que el
-- panel muestra dejaría de ser el que la base acepta.
alter table public.programa_lealtad
  drop constraint if exists programa_lealtad_slug_formato;
alter table public.programa_lealtad
  add constraint programa_lealtad_slug_formato check (
    slug is null
    or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 1 and 48)
  );


-- ------------------------------------------------------------
-- 2. Los slugs de lo que ya existe, derivados del nombre
--
-- Se derivan con el MISMO algoritmo que usa TypeScript
-- (`slugDeNombreDeTarjeta`) para que el link no cambie al aplicar esta
-- migración: lo que el panel venía mostrando —y lo que el negocio pudo
-- haber impreso— sigue resolviendo.
--
--   unaccent() no se usa a propósito: es una extensión que puede no
--   estar instalada, y esta migración no puede depender de eso. La
--   traducción de acentos se hace con `translate`, que es del núcleo.
--
-- El desempate de colisiones es POR ANTIGÜEDAD: si dos tarjetas del
-- mismo negocio derivan el mismo texto, la MÁS VIEJA se queda con el
-- slug limpio y la nueva recibe el sufijo. Es el mismo criterio que
-- protege al QR impreso — ante un empate, nunca gana la recién creada.
-- ------------------------------------------------------------

do $$
declare
  v_fila record;
  v_base text;
  v_slug text;
  v_n int;
begin
  for v_fila in
    select p.id, p.nombre, p.rancho_id, p.cuenta_id
      from public.programa_lealtad p
     where p.slug is null
     order by p.created_at asc, p.id asc
  loop
    -- nombre → minúsculas → sin acentos → solo [a-z0-9] → guiones
    v_base := lower(coalesce(v_fila.nombre, ''));
    v_base := translate(
      v_base,
      'áéíóúàèìòùäëïöüâêîôûãõñç',
      'aeiouaeiouaeiouaeiouaonc'
    );
    v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
    v_base := btrim(v_base, '-');
    v_base := left(v_base, 48);
    v_base := regexp_replace(v_base, '-+$', '');

    -- Nombre sin nada utilizable: se deja en null y el código cae al id
    -- del programa, que siempre existe. Inventar un texto acá sería un
    -- slug que nadie puede reproducir desde el nombre.
    if v_base = '' then
      continue;
    end if;

    v_slug := v_base;
    v_n := 1;
    -- Colisión dentro del MISMO negocio (cualquiera de las dos raíces).
    while exists (
      select 1 from public.programa_lealtad q
       where q.slug = v_slug
         and q.id <> v_fila.id
         and (
           (v_fila.rancho_id is not null and q.rancho_id = v_fila.rancho_id)
           or (v_fila.cuenta_id is not null and q.cuenta_id = v_fila.cuenta_id)
         )
    ) loop
      v_n := v_n + 1;
      v_slug := left(v_base, 45) || '-' || v_n::text;
      v_slug := regexp_replace(v_slug, '^-+', '');
    end loop;

    update public.programa_lealtad set slug = v_slug where id = v_fila.id;
  end loop;
end
$$;


-- ------------------------------------------------------------
-- 3. Los únicos, DESPUÉS del relleno
--
-- En este orden a propósito: creados antes, el relleno de arriba
-- tendría que ir esquivando un índice a medio poblar. Y parciales,
-- porque en Postgres los NULL no colisionan: mil tarjetas sin slug
-- conviven —que es lo que se quiere mientras el dueño no les ponga
-- uno— pero dos con el mismo slug en el mismo negocio, no.
-- ------------------------------------------------------------

create unique index if not exists programa_lealtad_slug_rancho_idx
  on public.programa_lealtad (rancho_id, slug)
  where slug is not null and rancho_id is not null;

create unique index if not exists programa_lealtad_slug_cuenta_idx
  on public.programa_lealtad (cuenta_id, slug)
  where slug is not null and cuenta_id is not null;


-- ------------------------------------------------------------
-- 4. Permisos: ninguno nuevo
--
-- `slug` es una columna más de `programa_lealtad`, que ya tiene su RLS
-- y sus grants desde la 0060: `anon` y `authenticated` LEEN el programa
-- activo (es parte de la cara pública del negocio, y este slug es
-- justamente lo que el negocio imprime en un cartel), y escribe el
-- dueño o un admin.
--
-- No hace falta —ni conviene— agregar política nueva: el `for all` del
-- dueño ya cubre el UPDATE de esta columna, y una política extra sería
-- una segunda definición del mismo permiso que un día diría otra cosa.
--
-- La página pública igual lee con la llave de servicio (un negocio
-- «solo lealtad» vive en estado 'pendiente' y la RLS no se lo mostraría
-- ni a un cliente logueado), así que esto no cambia lo que se ve.
-- ------------------------------------------------------------

comment on column public.programa_lealtad.slug is
  'El nombre corto de esta tarjeta dentro de su negocio (0199). Es lo '
  'que va en su link público y en su QR: /tarjeta/<negocio>/<slug>. '
  'Único por negocio, nunca global. null = todavía sin slug; el código '
  'deriva el mismo texto del nombre (llave-tarjeta.ts) y cae al id si '
  'del nombre no queda nada. El link corto /tarjeta/<negocio> NO usa '
  'esta columna: está clavado a la tarjeta más vieja del negocio, que '
  'es la del QR que ya está impreso.';

notify pgrst, 'reload schema';
