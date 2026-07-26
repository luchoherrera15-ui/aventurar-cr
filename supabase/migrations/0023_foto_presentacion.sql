-- ============================================================
-- AVENTUREA CR — El dueño elige qué foto va en cada lugar
--
-- Hasta ahora la foto grande de la sección de presentación se
-- escogía sola: "la primera que no sea la portada". El dueño no
-- tenía cómo decidir cuál de sus fotos quería ahí.
--
-- `foto_presentacion` guarda la URL elegida. Vacío = seguimos
-- escogiendo una automáticamente, como antes.
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos add column if not exists foto_presentacion text;

notify pgrst, 'reload schema';
