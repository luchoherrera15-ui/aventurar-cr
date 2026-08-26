-- ════════════════════════════════════════════════════════════════════
--  EL PERMISO DE LECTURA QUE LE FALTABA A `verificado`
-- ════════════════════════════════════════════════════════════════════
--
-- La 0214 creó la columna. Faltaba esto, y sin esto EL SITIO SE QUEDA
-- SIN NEGOCIOS.
--
-- ── QUÉ PASA EXACTAMENTE ────────────────────────────────────────────
--
-- `ranchos` no tiene un `grant select` sobre la tabla entera: tiene
-- permisos POR COLUMNA (ver 0155, y el mismo patrón repetido en la 0169
-- para `super_destacado`, la 0170 para `pais` y la 0187 para
-- `en_marketplace`). La misma fila guarda el SINPE del dueño y sus
-- datos de cobro, así que abrir la tabla entera no es una opción.
--
-- Cuando una consulta pide una columna que NO está en esa lista,
-- Postgres no devuelve la fila sin ese campo: RECHAZA LA CONSULTA
-- ENTERA con «permission denied for table ranchos».
--
-- O sea que sumar `verificado` a `COLUMNAS_CARD` —una línea de
-- TypeScript, sin tocar SQL— dejaba la portada, el directorio, los
-- favoritos y el carrusel COMPLETAMENTE VACÍOS. Sin error en pantalla,
-- sin nada rojo en la consola, sin nada en el log del servidor: la
-- página responde 200 y no hay un solo negocio.
--
-- Se encontró probando la consulta con la anon key antes de desplegar.
-- El `npm run build` pasa, los tipos pasan, el linter pasa y las 3118
-- pruebas pasan: ninguna de esas cosas habla con la base con los
-- permisos del visitante. Lo único que lo agarra es preguntarle a la
-- base como le pregunta quien entra al sitio.
--
-- ⚠️ REGLA PARA LA PRÓXIMA COLUMNA PÚBLICA DE `ranchos`: agregarla a
-- `COLUMNAS_CARD` (o a cualquier `select` público) SIN este grant no
-- rompe un pedazo — apaga el marketplace.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ranchos' and column_name = 'verificado'
  ) then
    -- `anon`: quien mira el sitio sin cuenta, que es casi todo el mundo.
    execute 'grant select (verificado) on table public.ranchos to anon';
    -- `authenticated`: quien entró con su cuenta ve las mismas tarjetas.
    execute 'grant select (verificado) on table public.ranchos to authenticated';
  end if;
end $$;

-- El permiso es de LECTURA y nada más. Escribirla sigue bloqueado por el
-- trigger de la 0214: solo un admin puede verificar un negocio, y ese
-- candado se comprobó intentando saltarlo con el service_role.
