-- ============================================================
-- ¿QUÉ HAY DE VERDAD EN ESTA BASE? — diagnóstico, no migración
--
-- No escribe nada. Se pega, se corre, y devuelve una tabla que dice
-- qué existe y qué no, con la migración que trae cada cosa.
--
-- Existe porque ir descubriendo lo que falta un error a la vez es
-- carísimo: cada intento son 2.200 líneas pegadas, un fallo a la mitad
-- y otra vuelta. Esto responde todo de un solo tiro.
-- ============================================================

select
  orden,
  objeto,
  migracion,
  case when existe then '✅ está' else '❌ FALTA' end as estado
from (
  values
    -- ── Base vieja, todo esto debería estar hace rato ──────────────
    (1,  'tabla   ranchos',                 '0001', to_regclass('public.ranchos')                is not null),
    (2,  'tabla   perfiles',                '0008', to_regclass('public.perfiles')               is not null),
    (3,  'func    is_admin()',              '0008', to_regproc('public.is_admin')                is not null),
    (4,  'ext     pgcrypto',                '0001', exists (select 1 from pg_extension where extname = 'pgcrypto')),

    -- ── Lealtad, el núcleo ────────────────────────────────────────
    (10, 'tabla   programa_lealtad',        '0060', to_regclass('public.programa_lealtad')       is not null),
    (11, 'tabla   miembros',                '0060', to_regclass('public.miembros')               is not null),
    (12, 'tabla   recompensas',             '0060', to_regclass('public.recompensas')            is not null),
    (13, 'tabla   transacciones_puntos',    '0060', to_regclass('public.transacciones_puntos')   is not null),
    (14, 'tabla   pases_wallet',            '0060', to_regclass('public.pases_wallet')           is not null),
    (15, 'tabla   registros_dispositivo',   '0060', to_regclass('public.registros_dispositivo')  is not null),

    -- ── Correo y consentimiento ───────────────────────────────────
    (20, 'tabla   consentimientos',         '0082', to_regclass('public.consentimientos')        is not null),
    (21, 'tabla   supresiones_correo',      '0082', to_regclass('public.supresiones_correo')     is not null),

    -- ── CRM y agenda ──────────────────────────────────────────────
    (30, 'tabla   clientes_negocio',        '0109', to_regclass('public.clientes_negocio')       is not null),
    (31, 'func    gestiona_rancho()',       '0116', to_regproc('public.gestiona_rancho')         is not null),
    (32, 'tabla   addons_negocio',          '0077', to_regclass('public.addons_negocio')         is not null),

    -- ── Lealtad operable ──────────────────────────────────────────
    (40, 'tabla   canjes',                  '0125', to_regclass('public.canjes')                 is not null),
    (41, 'tabla   integraciones_pos',       '0125', to_regclass('public.integraciones_pos')      is not null),
    (42, 'tabla   eventos_integracion',     '0125', to_regclass('public.eventos_integracion')    is not null),
    (43, 'func    canjear_recompensa()',    '0125', to_regproc('public.canjear_recompensa')      is not null),
    (44, 'tabla   rancho_colaboradores',    '0127', to_regclass('public.rancho_colaboradores')   is not null),

    -- ── Las que faltan por pegar (0132 → 0138) ────────────────────
    (50, 'tabla   oferta_bienvenida',       '0132', to_regclass('public.oferta_bienvenida')      is not null),
    (51, 'col     pase_banner_url',         '0132', exists (select 1 from information_schema.columns
                                                             where table_name = 'programa_lealtad'
                                                               and column_name = 'pase_banner_url')),
    (52, 'check   plan_lealtad con prueba', '0133', exists (select 1 from pg_constraint
                                                             where conname = 'ranchos_plan_lealtad_check'
                                                               and pg_get_constraintdef(oid) like '%prueba%')),
    (53, 'tabla   cuentas',                 '0134', to_regclass('public.cuentas')                is not null),
    (54, 'func    pertenece_a_cuenta()',    '0134', to_regproc('public.pertenece_a_cuenta')      is not null),
    (55, 'col     programa.beneficio',      '0135', exists (select 1 from information_schema.columns
                                                             where table_name = 'programa_lealtad'
                                                               and column_name = 'beneficio')),
    (56, 'col     programa.dias_permitidos','0136', exists (select 1 from information_schema.columns
                                                             where table_name = 'programa_lealtad'
                                                               and column_name = 'dias_permitidos')),
    (57, 'tabla   intentos_canje',          '0137', to_regclass('public.intentos_canje')         is not null),
    (58, 'tabla   personas',                '0138', to_regclass('public.personas')               is not null),
    (59, 'col     miembros.persona_id',     '0138', exists (select 1 from information_schema.columns
                                                             where table_name = 'miembros'
                                                               and column_name = 'persona_id'))
) as t(orden, objeto, migracion, existe)
order by orden;
