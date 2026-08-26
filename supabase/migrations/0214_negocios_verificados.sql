-- ════════════════════════════════════════════════════════════════════
--  NEGOCIOS VERIFICADOS
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (26 ago 2026): «tendremos NEGOCIOS VERIFICADOS Y NO
-- VERIFICADOS; los verificados, en lugar de "Nuevo", tendrán un tag que
-- diga Verificado y una insignia verde al lado, pequeña. Todos los que
-- están funcionando actuales dejalos como verificados».
--
-- ── QUÉ SIGNIFICA, Y QUÉ NO ─────────────────────────────────────────
--
-- «Verificado» es una afirmación de Bookea sobre un negocio: que existe,
-- que es quien dice ser y que alguien de acá lo comprobó. No se deduce
-- de ningún otro dato — no es «tiene fotos», ni «tiene reservas», ni
-- «pagó». Por eso es una columna que se escribe a mano y no una vista
-- calculada: el día que se derive de otra cosa, deja de querer decir lo
-- que la insignia promete.
--
-- ── NO CONFUNDIR CON `verificacion_proveedores` ─────────────────────
--
-- Esa tabla YA EXISTE y guarda los papeles que el proveedor sube para
-- que el admin los revise antes de aprobarlo: link de redes y cédula,
-- en un bucket privado. Es el EXPEDIENTE.
--
-- Esta columna es el RESULTADO PUBLICADO de esa revisión: lo único que
-- ve el visitante. Se mantienen separadas a propósito — el expediente
-- es dato sensible con acceso restringido, y la insignia es pública.
-- Una no se deriva de la otra automáticamente: que alguien haya subido
-- una cédula no significa que se haya comprobado.
--
-- Va en `ranchos` y no en una tabla aparte porque es un solo booleano
-- por negocio y lo lee TODA tarjeta del marketplace. Una tabla aparte
-- obligaría a un join en la consulta más caliente del sitio para
-- traerse un bit.
--
-- ── EL DEFAULT ES `false`, Y ESO ES LO IMPORTANTE ───────────────────
--
-- Un negocio nuevo NO nace verificado. Si el default fuera `true`, la
-- insignia dejaría de significar algo el mismo día: diría «verificado»
-- de cualquiera que se registre solo, que es exactamente lo contrario
-- de lo que una insignia de verificación existe para decir.

alter table public.ranchos
  add column if not exists verificado boolean not null default false;

comment on column public.ranchos.verificado is
  'Bookea comprobó que este negocio existe y es quien dice ser. Se escribe A MANO desde el panel de admin; nunca se deriva de otro dato. Ver 0214.';

-- ── EL RELLENO DE LOS QUE YA ESTABAN FUNCIONANDO ────────────────────
--
-- «Funcionando» = `estado = 'aprobado'`. Son los únicos que hoy
-- aparecen en el marketplace y muestran tarjeta; los `pendiente` no se
-- listan en ningún lado, así que marcarlos no cambiaría nada en
-- pantalla y sí diluiría el significado de la columna.
--
-- ⚠️ LOS DEMO QUEDAN FUERA, A PROPÓSITO. Un negocio sembrado por
-- nosotros para mostrar el producto no es un negocio verificado: es
-- utilería. Ponerle la insignia sería usar el sello de confianza sobre
-- algo que no existe, que es justo el uso que lo arruina.
--
-- ⚠️ TAMPOCO ENTRAN LOS CLIENTES DE LEALTAD EN `pendiente` (Pura
-- Matcha, Praia). Son negocios REALES —lo dice el historial del
-- proyecto— pero no están listados en el marketplace: no tienen tarjeta
-- donde mostrar nada. Si algún día se aprueban, se verifican desde el
-- panel como cualquier otro. Se deja dicho acá para que nadie lo lea
-- como un olvido.

update public.ranchos
set verificado = true
where estado = 'aprobado'
  and coalesce((detalles ->> 'demo')::boolean, false) = false;

-- ── ÍNDICE ──────────────────────────────────────────────────────────
--
-- Parcial y solo sobre los verificados: hoy son un puñado contra el
-- total, y un índice completo sobre un booleano no le sirve al
-- planificador para nada. Sirve para «listame los verificados», que es
-- la consulta que el panel de admin va a hacer.

create index if not exists ranchos_verificados_idx
  on public.ranchos (created_at desc)
  where verificado = true;

-- ── QUIÉN PUEDE ESCRIBIRLO ──────────────────────────────────────────
--
-- ⚠️ NO SE TOCA NINGUNA POLÍTICA RLS ACÁ, Y ES UNA DECISIÓN.
--
-- Las políticas de UPDATE de `ranchos` ya dejan que el dueño edite SU
-- negocio. Si esta columna se quedara así, un dueño podría marcarse
-- verificado él mismo desde cualquier cliente con la anon key — y una
-- insignia que cada quien se pone solo no verifica nada.
--
-- El candado va en un trigger y no en una política nueva, porque el
-- problema no es QUIÉN toca la fila (el dueño sí puede tocarla) sino
-- QUÉ COLUMNA de esa fila está tocando.

create or replace function public.ranchos_verificado_solo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verificado is distinct from old.verificado and not public.is_admin() then
    raise exception 'Solo un administrador de Bookea puede verificar un negocio.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists ranchos_verificado_solo_admin_trg on public.ranchos;
create trigger ranchos_verificado_solo_admin_trg
  before update on public.ranchos
  for each row
  execute function public.ranchos_verificado_solo_admin();
