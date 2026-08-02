-- ============================================================
-- BOOKEA — El álbum hereda el tema, y cada quien borra lo suyo (0089)
--
-- Dos cosas que el álbum de fotos (0068) no sabía hacer.
--
-- 1) EL ÁLBUM SE VE COMO SU INVITACIÓN
--
--    El álbum tenía el crema y el navy quemados en la página, así que
--    la boda en verde botella y el cumpleaños en fucsia llegaban al
--    mismo álbum beige. La invitación tampoco guardaba su paleta en
--    ningún lado: `tema` quedó vestigial y el diseño de verdad vive en
--    `html_personalizado`, que es CSS a la medida.
--
--    `invitaciones.paleta` guarda {fondo, tinta, acento}. Cuando está
--    vacía, la página deduce los colores leyendo ese HTML
--    (src/lib/invitaciones/paleta.ts) — así las invitaciones que YA
--    existen heredan su color sin que nadie las toque. Llenarla a mano
--    desde el panel es para cuando la deducción se equivoca.
--
-- 2) BORRAR LA FOTO QUE UNO SUBIÓ
--
--    Los invitados suben sin cuenta, así que "el que la subió" no tiene
--    identidad: si alguien sube la foto equivocada, no había forma de
--    quitarla salvo pedírselo al equipo.
--
--    La marca de quién subió qué es un token que se queda en SU
--    navegador. Acá se guarda solo su hash, y en una tabla aparte:
--
--      · Aparte, porque `album_fotos` es de lectura pública (la grilla
--        la lista para cualquiera). Una columna con la llave al lado de
--        la foto sería una llave publicada — cualquiera leería el hash
--        de las fotos ajenas. `album_foto_llaves` NO tiene política de
--        SELECT: nadie la lee, ni el dueño del álbum. Solo el servidor
--        con la llave de servicio, al momento de borrar.
--
--      · `foto_id` es la clave primaria a propósito: una foto tiene UNA
--        llave y el segundo intento choca (23505). Sin eso, cualquiera
--        insertaría su propia llave sobre una foto ajena y se quedaría
--        con el derecho a borrarla.
--
--    El borrado en sí NO se abre a nadie: no hay grant de DELETE sobre
--    `album_fotos`. Pasa por una server action que corre con la llave
--    de servicio y decide — dueño del álbum, admin, o quien presente el
--    token que corresponde.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1) La paleta de la invitación
-- ------------------------------------------------------------

alter table invitaciones add column if not exists paleta jsonb;

comment on column invitaciones.paleta is
  'Colores del álbum de este evento: {"fondo":"#…","tinta":"#…","acento":"#…"}. Null = se deducen del html_personalizado.';

-- ------------------------------------------------------------
-- 2) La llave de cada foto
-- ------------------------------------------------------------

create table if not exists album_foto_llaves (
  foto_id uuid primary key references album_fotos(id) on delete cascade,
  -- SHA-256 en hexadecimal del token que se quedó en el navegador de
  -- quien subió la foto. El token en claro no llega nunca a la base.
  token_hash text not null check (char_length(token_hash) between 32 and 128),
  created_at timestamptz not null default now()
);

alter table album_foto_llaves enable row level security;

-- Se puede dejar la llave de una foto recién subida a un álbum activo.
-- No hay política de SELECT, UPDATE ni DELETE: la tabla se escribe una
-- vez y solo la lee el servidor con la llave de servicio.
drop policy if exists "Cualquiera guarda la llave de su foto" on album_foto_llaves;
create policy "Cualquiera guarda la llave de su foto" on album_foto_llaves
  for insert to anon, authenticated
  with check (
    exists (
      select 1
        from album_fotos f
        join albumes a on a.id = f.album_id
       where f.id = foto_id
         and a.estado = 'activo'
    )
  );

grant insert on album_foto_llaves to anon, authenticated;
-- Sin `grant select`: la llave no se lee desde el navegador.

notify pgrst, 'reload schema';
