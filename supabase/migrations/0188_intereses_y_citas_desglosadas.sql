
-- ─────────────────────────────────────────────────────────────────────
-- 0188: los gustos de cada persona, y Citas con el detalle que le
--       faltaba.
--
-- Dos cosas que van juntas porque una no sirve sin la otra:
--
--  (1) Cuando alguien abre la app por primera vez le preguntamos qué
--      anda buscando. Eso hay que guardarlo en algún lado para que el
--      inicio le muestre primero lo suyo. Tabla `preferencias_usuario`.
--
--  (2) Los intereses que se pueden elegir tienen que EXISTIR. Eventos
--      ya tenía todo el detalle (wedding planner, barra de cócteles,
--      catering… son subcategorías desde la 0018/0021). Citas no: solo
--      tenía seis categorías anchas —belleza, barbería, uñas, spa,
--      consultorio, otros— y CERO subcategorías. Un consultorio de
--      psicología y uno de odontología eran, para la base, la misma
--      cosa.
--
-- ── LO QUE ESTA MIGRACIÓN NO HACE ────────────────────────────────────
-- No toca ni un solo negocio existente. Solo abre valores nuevos que
-- antes el CHECK rechazaba, y crea una tabla que nadie tenía. Un
-- negocio ya cargado sigue exactamente donde estaba.
--
-- Es seguro correr esta migración varias veces.
-- ─────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════
-- 1. CATEGORÍAS NUEVAS DE CITAS
-- ═══════════════════════════════════════════════════════════════════
--
-- Tres rubros que el dueño pidió y que no entraban en ninguna de las
-- seis que había:
--
--   tatuajes   — tatuadores y perforaciones. No es "belleza": es otro
--                oficio, otra regulación sanitaria y otro cliente.
--   automotriz — lavacar, polarizado, detallado. Se agenda igual que
--                una barbería, pero nadie lo busca en "otros".
--   mascotas   — peluquería canina y veterinaria. Mismo caso.
--
-- La lista completa se re-escribe entera (no se le agregan tres
-- valores a un CHECK existente) porque un CHECK no se puede extender:
-- se tira y se vuelve a poner. Por eso van también los 35 de antes.

alter table ranchos drop constraint if exists ranchos_categoria_check;
alter table ranchos add constraint ranchos_categoria_check
  check (categoria in (
    -- Eventos (0008/0018)
    'lugares', 'alimentacion', 'animacion', 'organizacion', 'decoracion', 'otros',
    -- Citas / Servicios (0058)
    'belleza', 'barberia', 'unas', 'spa', 'consultorio',
    -- Citas / Servicios — nuevas acá
    'tatuajes', 'automotriz', 'mascotas',
    -- Hospedajes (0062)
    'casa', 'villa', 'hotel', 'cabana', 'apartamento', 'experiencia',
    -- Restaurantes (0076)
    'tipica', 'carnes', 'mariscos', 'pastas', 'pizza', 'hamburguesas',
    'china', 'japonesa', 'coreana', 'mexicana', 'peruana',
    'mediterranea', 'vegetariana', 'cafeteria', 'postres', 'bar', 'fusion'
  ));


-- ═══════════════════════════════════════════════════════════════════
-- 2. SUBCATEGORÍAS DE CITAS
-- ═══════════════════════════════════════════════════════════════════
--
-- ── POR QUÉ MEDICINA SE DESGLOSA Y LAS OTRAS CASI NO ─────────────────
-- El dueño lo pidió explícitamente para medicina, y tiene razón de
-- producto: nadie busca "un consultorio". Busca un dentista, o una
-- psicóloga, o un fisioterapeuta. Un solo tag de "Consultorios" le
-- pide al cliente que abra doce fichas para encontrar la que necesita.
--
-- Las de belleza y spa se desglosan menos porque ahí el negocio SÍ es
-- el que se busca ("un salón", "un spa") y los servicios puntuales ya
-- viven en el catálogo de cada negocio, no en su clasificación.
--
-- Igual que arriba: la lista va completa porque el CHECK se reemplaza.

alter table ranchos drop constraint if exists ranchos_subcategoria_check;
alter table ranchos add constraint ranchos_subcategoria_check
  check (subcategoria is null or subcategoria in (
    -- ── EVENTOS (0018 + 0021, intactas) ──────────────────────────
    -- Lugares
    'sala_eventos', 'rancho_fiestas', 'lugar_fiestas_infantiles',
    'finca_fiestas', 'hotel_eventos', 'restaurante',
    'parque_piscina', 'centro_negocios',
    -- Alimentación
    'catering', 'queques', 'catering_infantil', 'bebidas_domicilio',
    'mesas_dulces', 'food_trucks', 'comidas_domicilio', 'parrillada',
    'bartender', 'barra_cocteles', 'barra_cafe', 'barra_matcha',
    'barra_cerveza', 'barra_jugos', 'barra_helados', 'barra_snacks',
    -- Animación
    'dj_discomovil', 'luces_sonido', 'grupos_musicales', 'fiestas_neon',
    'animadores', 'maestros_ceremonias', 'mariachis',
    'payasos_pintacaritas', 'magos', 'inflables',
    'animacion_infantil', 'polvora',
    -- Organización
    'articulos_fiesta', 'invitaciones', 'fotografos', 'photo_booth',
    'edecanes', 'wedding_planner', 'produccion_audiovisual',
    'agencias_btl', 'organizacion_eventos', 'articulos_promocionales',
    -- Decoración
    'decoracion_eventos', 'decoracion_infantil', 'floristerias',
    'toldos', 'tarimas', 'exhibidores_stands', 'graderias',
    'sillas_mesas', 'manteles', 'equipo_eventos',
    -- Otros
    'revelacion_sexo', 'transporte', 'seguridad',
    'banos_portatiles', 'planta_electrica', 'otro',

    -- ── CITAS / SERVICIOS (nuevas acá) ───────────────────────────
    -- Belleza
    'salon_belleza', 'peinados', 'maquillaje', 'cejas_pestanas',
    'depilacion', 'tratamientos_faciales',
    -- Uñas
    'manicure', 'pedicure', 'unas_acrilicas',
    -- Barbería
    'corte_caballero', 'afeitado_barba',
    -- Spa y bienestar
    'masajes', 'spa_dia', 'sauna_jacuzzi',
    -- Consultorios — el desglose de medicina
    'medicina_general', 'odontologia', 'ortodoncia', 'dermatologia',
    'psicologia', 'nutricion', 'fisioterapia', 'oftalmologia',
    'pediatria', 'ginecologia', 'quiropractica', 'laboratorio_clinico',
    -- Tatuajes
    'tatuajes', 'perforaciones',
    -- Automotriz
    'lavacar', 'polarizado', 'detallado_auto', 'mecanica',
    -- Mascotas
    'grooming', 'veterinaria'
  ));


-- ═══════════════════════════════════════════════════════════════════
-- 3. LOS GUSTOS DE CADA PERSONA
-- ═══════════════════════════════════════════════════════════════════
--
-- ── POR QUÉ `cliente_id` Y NO `auth.users` A SECAS ──────────────────
-- Es el mismo id (`auth.users.id`), pero se nombra `cliente_id` porque
-- es como se llama en el resto del esquema (`favoritos.cliente_id`,
-- 0033) y porque quien contesta el onboarding es un cliente, no un
-- dueño de negocio.
--
-- ── POR QUÉ UNA FILA POR PERSONA Y NO UNA POR INTERÉS ───────────────
-- Los intereses se leen SIEMPRE juntos —para ordenar el inicio hace
-- falta la lista entera— y se reescriben siempre juntos: la persona
-- vuelve a la pantalla y marca otra combinación. Una tabla con una
-- fila por interés obligaría a un join y a un borrado-y-reinserción en
-- cada guardado, para un dato que nunca se consulta de a uno.
--
-- ── EL ONBOARDING PASA ANTES DEL LOGIN ──────────────────────────────
-- Y ahí está el detalle importante: la primera vez que alguien abre la
-- app todavía no tiene cuenta. Los intereses se guardan primero en el
-- teléfono (AsyncStorage) y se suben acá recién cuando la persona se
-- registra o entra. Por eso esta tabla NO es la fuente única: es la
-- copia que sobrevive al cambio de teléfono.

create table if not exists preferencias_usuario (
  cliente_id  uuid primary key references auth.users(id) on delete cascade,
  -- 'eventos' | 'citas'. Qué eligió en la primera pantalla.
  -- Sin CHECK a propósito: si mañana se agrega una vertical al
  -- onboarding, no quiero que la app falle al guardar contra una base
  -- que todavía no tiene la migración. El valor lo valida la app.
  vertical    text,
  -- Los ids de `mobile/src/lib/intereses.ts` / `src/lib/intereses.ts`.
  -- Un arreglo de texto y no una FK: el catálogo de intereses vive en
  -- el código —cambia con cada versión de la app— y una FK obligaría a
  -- una migración por cada interés nuevo. La app descarta sola los ids
  -- que ya no existen (`interesesValidos`).
  intereses   text[] not null default '{}',
  -- true = tocó "Omitir". Se distingue de "no contestó todavía"
  -- (sin fila) porque son cosas distintas: a quien omitió no le
  -- volvemos a preguntar.
  omitido     boolean not null default false,
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table preferencias_usuario is
  'Qué le interesa a cada persona, contestado en el onboarding de la app. Ordena su inicio; no filtra nada.';
comment on column preferencias_usuario.vertical is
  'eventos | citas — qué eligió en la primera pantalla del onboarding.';
comment on column preferencias_usuario.intereses is
  'Ids del catálogo de intereses (vive en el código, no en la base).';
comment on column preferencias_usuario.omitido is
  'true = tocó Omitir. Distinto de no tener fila, que es "todavía no se le preguntó".';

alter table preferencias_usuario enable row level security;

-- Cada quien y solo cada quien. No hay lectura de admin acá: los
-- gustos de una persona no son un dato de operación de la plataforma,
-- y si algún día hacen falta para una métrica, se agregan agregados,
-- no fila por fila.
drop policy if exists "Cada quien ve sus preferencias" on preferencias_usuario;
create policy "Cada quien ve sus preferencias" on preferencias_usuario
  for select using (cliente_id = auth.uid());

drop policy if exists "Cada quien guarda sus preferencias" on preferencias_usuario;
create policy "Cada quien guarda sus preferencias" on preferencias_usuario
  for insert with check (cliente_id = auth.uid());

drop policy if exists "Cada quien cambia sus preferencias" on preferencias_usuario;
create policy "Cada quien cambia sus preferencias" on preferencias_usuario
  for update using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());

drop policy if exists "Cada quien borra sus preferencias" on preferencias_usuario;
create policy "Cada quien borra sus preferencias" on preferencias_usuario
  for delete using (cliente_id = auth.uid());

notify pgrst, 'reload schema';
