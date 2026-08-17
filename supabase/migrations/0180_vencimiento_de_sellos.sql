
-- ============================================================
-- BOOKEA — Los sellos se vencen por inactividad (0180)
--
-- «Si no se canjean los sellos completos en X, se reinician.»
--
-- ------------------------------------------------------------
-- PLAZO DESDE EL ÚLTIMO SELLO, NO FECHA FIJA
-- ------------------------------------------------------------
-- Una fecha fija (31 de diciembre) castiga a quien recién empezó: el
-- que gana su primer sello el 30 lo pierde al día siguiente y no
-- vuelve nunca. Acá cada cliente tiene SU reloj: se cuenta desde su
-- último movimiento. El que sigue viniendo no pierde nada — que es el
-- único comportamiento que un programa de fidelidad puede permitirse.
--
-- ------------------------------------------------------------
-- POR QUÉ DOS COLUMNAS Y NO UNA
-- ------------------------------------------------------------
-- `sellos_vencen_meses` es la regla. `sellos_vencen_desde` es CUÁNDO
-- se encendió, y existe para que la regla no sea retroactiva.
--
-- Sin la segunda: el dueño enciende hoy «3 meses», y todo el que no
-- viene hace 4 pierde sus sellos EN LA CORRIDA SIGUIENTE, sin haber
-- recibido un solo aviso. Eso es exactamente lo que este proyecto ya
-- decidió no hacer con los planes retirados y con la pausa por falta
-- de pago: nadie pierde de golpe por un cambio de configuración
-- ajeno.
--
-- Con la segunda, el reloj de TODOS arranca (como mínimo) el día que
-- la regla se enciende:
--
--     vence_el = max(último movimiento, sellos_vencen_desde) + meses
--
-- O sea que al encenderla nadie vence antes de `meses` meses, y en el
-- medio le llega el correo de aviso. El que sí viene seguido no nota
-- la diferencia: para él manda su último sello, que es más reciente.
--
-- La escribe el guardado (crear-actions / pases-actions) cuando la
-- regla pasa de apagada a encendida; apagarla la deja en null.
--
-- ------------------------------------------------------------
-- EL REINICIO NO ES UN `update saldo = 0`
-- ------------------------------------------------------------
-- No hay ningún saldo que poner en cero: el saldo se DERIVA de
-- `transacciones_puntos` (0060). El reinicio es un movimiento más del
-- ledger —`tipo = 'ajuste'`, negativo, con su motivo— y por eso queda
-- explicado para siempre: el dueño puede ver en la ficha del cliente
-- por qué sus 7 sellos son hoy 0, y la reversión (0139) lo puede
-- deshacer como cualquier otro movimiento.
--
-- La IDEMPOTENCIA sale del índice único que ya existe:
-- `transacciones_puntos_referencia_unica (miembro_id, referencia)`.
-- La referencia del reinicio es determinista —«venc:<fecha de corte>»,
-- ver src/lib/lealtad/vencimiento-sellos.ts— así que dos corridas del
-- cron el mismo día calculan la MISMA llave y la segunda choca contra
-- el índice en vez de restar los sellos dos veces. Esta migración no
-- agrega ningún índice nuevo para eso: el que hace falta ya está.
--
-- ------------------------------------------------------------
-- SOLO PARA `sellos`
-- ------------------------------------------------------------
-- Es lo que se pidió y es donde tiene sentido: los sellos son una
-- vuelta que se completa. En `cashback` y `giftcard` el saldo es
-- PLATA que el cliente ya pagó o ya ganó, y hacerla desaparecer por
-- no volver es otra conversación (y en varios países, otra ley). En
-- `puntos` sería defendible, pero no se pidió: la columna existe para
-- las tarjetas de sellos y el motor no la mira en ninguna otra.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ── 1. La regla, en columnas ────────────────────────────────────
-- En columnas y no adentro del jsonb `beneficio` por la misma razón
-- que las reglas de la 0136: esto lo lee un motor que le QUITA sellos
-- a alguien. Una regla que decide eso no puede vivir en un campo de
-- texto que nadie valida — el día que alguien escriba
-- `{"vencenMeses": "tres"}` el barrido no vencería nada, o peor,
-- vencería todo.
alter table programa_lealtad add column if not exists sellos_vencen_meses smallint;
alter table programa_lealtad add column if not exists sellos_vencen_desde timestamptz;

-- 1 mes es agresivo pero legítimo (una promo de temporada); 60 son
-- cinco años, que es más que la vida de cualquier tarjeta de cartón.
-- Fuera de ese rango es un dedo que se resbaló, no una decisión.
alter table programa_lealtad drop constraint if exists programa_lealtad_vencimiento_sellos_check;
alter table programa_lealtad add constraint programa_lealtad_vencimiento_sellos_check
  check (sellos_vencen_meses is null or sellos_vencen_meses between 1 and 60);

comment on column programa_lealtad.sellos_vencen_meses is
  'Meses de inactividad tras los cuales los sellos del cliente se '
  'reinician (0180). NULL = no vencen nunca, que es el comportamiento '
  'de siempre y el de toda tarjeta que no configure esto. Solo aplica '
  'a modo = ''sellos''.';

comment on column programa_lealtad.sellos_vencen_desde is
  'Cuándo se ENCENDIÓ la regla (0180). El reloj de cada cliente '
  'arranca en max(su último movimiento, esta fecha), para que '
  'encender la regla no le borre los sellos en el acto a quien hace '
  'rato que no viene. NULL cuando la regla está apagada.';

-- El barrido diario pregunta «¿qué tarjetas tienen esta regla?». Con
-- un índice parcial esa consulta no recorre las miles que no la
-- tienen, y el índice pesa lo que pesan las que sí.
create index if not exists programa_lealtad_sellos_vencen_idx
  on programa_lealtad (id)
  where sellos_vencen_meses is not null;

-- ── 2. El aviso que se manda UNA sola vez ───────────────────────
--
-- El correo de sellos de este repo se acotó a HITOS a propósito (ver
-- src/lib/correo/sello-acreditado.ts: el dueño recibió tres correos
-- en un día y con razón se quejó). El aviso de vencimiento sigue esa
-- filosofía: UNO solo, unos días antes, en el único momento en que
-- sirve — cuando todavía se puede hacer algo.
--
-- Que sea uno solo NO se resuelve con un `if` en TypeScript: el cron
-- corre todos los días y la ventana de aviso dura varios: sin esta
-- tabla, el cliente recibiría el mismo correo cada mañana durante una
-- semana. La llave es (miembro, fecha de corte) y la restricción
-- única es la que decide; la fila se INSERTA ANTES de mandar el
-- correo —se reclama, como la bandera de la 0147— así que dos
-- corridas simultáneas no pueden mandar dos.
--
-- Guarda la fecha de corte y no «cuándo se avisó» como llave porque
-- el corte se MUEVE: si el cliente vuelve y sella, su vencimiento se
-- corre y el aviso de la vuelta siguiente es un aviso distinto, que
-- debe poder mandarse.
create table if not exists avisos_vencimiento_sellos (
  id uuid primary key default gen_random_uuid(),
  miembro_id uuid not null references miembros(id) on delete cascade,
  -- La fecha en que se le vencen los sellos, en la zona del NEGOCIO.
  -- `date` y no timestamptz por lo mismo que las vigencias de la
  -- 0136: el negocio piensa en días, y en UTC el día se corre seis
  -- horas.
  vence_el date not null,
  -- Cuántos sellos tenía cuando se le avisó. Es para poder contestar
  -- «¿qué decía el correo que recibí?» sin adivinar.
  saldo integer not null default 0,
  enviado_en timestamptz not null default now(),
  unique (miembro_id, vence_el)
);

create index if not exists avisos_vencimiento_sellos_miembro_idx
  on avisos_vencimiento_sellos (miembro_id, vence_el desc);

alter table avisos_vencimiento_sellos enable row level security;

-- SOLO LECTURA, y solo lo propio: el cliente ve los avisos que se le
-- mandaron y el dueño los de su programa. Escribe únicamente el
-- servidor con la llave de servicio (que salta RLS), igual que el
-- ledger — si el navegador pudiera insertar acá, cualquiera podría
-- reclamar el aviso de otro y dejarlo sin avisar.
drop policy if exists "Cada quien lee sus avisos de vencimiento" on avisos_vencimiento_sellos;
create policy "Cada quien lee sus avisos de vencimiento" on avisos_vencimiento_sellos
  for select to authenticated
  using (
    exists (
      select 1 from miembros m
      where m.id = miembro_id
        and (
          m.cliente_id = auth.uid()
          or exists (
            select 1 from programa_lealtad p
            join ranchos r on r.id = p.rancho_id
            where p.id = m.programa_id and (r.owner_id = auth.uid() or is_admin())
          )
        )
    )
  );

grant select on avisos_vencimiento_sellos to authenticated;

comment on table avisos_vencimiento_sellos is
  'El aviso de «tus sellos están por vencer» (0180). Una fila por '
  'miembro y fecha de corte: la restricción única ES la garantía de '
  'que el correo sale UNA vez, aunque el cron corra todos los días de '
  'la ventana de aviso y aunque corra dos veces el mismo día.';
