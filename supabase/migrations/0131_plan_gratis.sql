
-- ─────────────────────────────────────────────────────────────────────
-- 0131: el plan GRATIS (5 miembros).
--
-- La definición vive en TypeScript (src/lib/lealtad/planes.ts, como
-- todos los planes); acá solo se amplían los CHECK que la base ya
-- tenía para que 'gratis' sea un valor válido:
--   · ranchos.plan_lealtad          (0124)
--   · solicitudes_lealtad.plan      (0126)
--
-- El TOPE de 5 no se guarda: sale de la definición del plan y lo hace
-- cumplir el servidor al afiliar — igual que los demás topes.
-- ─────────────────────────────────────────────────────────────────────

alter table ranchos drop constraint if exists ranchos_plan_lealtad_check;
alter table ranchos add constraint ranchos_plan_lealtad_check
  check (plan_lealtad is null or plan_lealtad in ('gratis', 'basico', 'estandar', 'enterprise'));

alter table solicitudes_lealtad drop constraint if exists solicitudes_lealtad_plan_check;
alter table solicitudes_lealtad add constraint solicitudes_lealtad_plan_check
  check (plan in ('gratis', 'basico', 'estandar', 'enterprise'));
