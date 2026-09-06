-- ════════════════════════════════════════════════════════════════════
--  0237 · SOLUTIONS — un enlace de formato «texto» puede ser un párrafo
-- ════════════════════════════════════════════════════════════════════
--
-- La 0236 sumó `formato` a los enlaces (botón, ícono, título, texto).
-- Pero el CHECK de `etiqueta` de la 0230 topaba en 40 caracteres, que
-- es el largo de un botón, no de un párrafo: «Lunes a sábado de 9 a 18.
-- Envíos a todo México en 48 h.» no entraba. Se sube el tope de la
-- columna a 160; el tope de 40 para botones y títulos lo sigue
-- imponiendo el código (TOPES.etiquetaLink), donde depende del formato.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.solutions_links'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%etiqueta%'
  loop
    execute format('alter table public.solutions_links drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.solutions_links
  add constraint solutions_links_etiqueta_check
  check (char_length(etiqueta) between 1 and 160);

notify pgrst, 'reload schema';
