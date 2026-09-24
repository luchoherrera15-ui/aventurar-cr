-- CELEBRAR — 0248 · las rutas /demos y /demo son del sistema: ninguna
-- celebración puede reclamarlas como slug. (Ver SEGMENTOS_SISTEMA en
-- src/lib/celebrar/rutas.ts.) Aditiva e idempotente.
insert into public.celebrar_slugs (slug, motivo) values ('demos', 'sistema'), ('demo', 'sistema')
on conflict (slug) do nothing;
