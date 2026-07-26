-- ============================================================
-- AVENTUREA CR — Subcategoría "tipo de lugar" para salones/ranchos,
-- para poder filtrar el directorio como Salas de eventos, Ranchos
-- para fiestas, Fincas para fiestas, etc. Es seguro correr esta
-- migración varias veces.
-- ============================================================

alter table ranchos add column if not exists tipo_lugar text;

alter table ranchos drop constraint if exists ranchos_tipo_lugar_check;
alter table ranchos add constraint ranchos_tipo_lugar_check
  check (
    tipo_lugar is null or tipo_lugar in (
      'sala_eventos',
      'rancho_fiestas',
      'lugar_fiestas_infantiles',
      'finca_fiestas',
      'hotel_eventos',
      'restaurante',
      'parque_piscina',
      'centro_negocios'
    )
  );
