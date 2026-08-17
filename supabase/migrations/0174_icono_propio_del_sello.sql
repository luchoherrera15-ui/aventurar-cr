-- ============================================================
-- BOOKEA — El ícono PROPIO del sello (0174)
--
-- El negocio sube SU dibujo y lo usa adentro de cada círculo, además
-- de los doce del catálogo (0145).
--
-- ------------------------------------------------------------
-- POR QUÉ HACE FALTA
-- ------------------------------------------------------------
-- La 0145 arregló el caso más común —el logo ilegible a 30 píxeles— con
-- doce dibujos hechos para verse chiquitos: café, tijera, uñas, comida,
-- cerveza, pesa, flor, mascota, auto, corazón, estrella, regalo.
--
-- Doce cubren los rubros de barrio y dejan afuera al resto: la óptica,
-- la lavandería, la heladería, y sobre todo la marca que YA tiene su
-- símbolo propio y no quiere una estrella genérica adentro de su
-- tarjeta. Para esos, la única salida era «Mi logo» — o sea el caso que
-- la 0145 existía para evitar.
--
-- ------------------------------------------------------------
-- POR QUÉ SON DOS COLUMNAS Y NO UNA
-- ------------------------------------------------------------
-- Podría haber sido una sola columna con la URL, y la elección se
-- deduciría de si está llena. Pero entonces elegir «Café» un rato
-- borraría el archivo, y volver atrás obligaría a subirlo de nuevo.
--
-- Así que se separan las dos preguntas:
--
--   · `pase_sello_icono`     — QUÉ se eligió: uno de los doce, el
--                              centinela 'propio', o null (el logo);
--   · `pase_sello_icono_url` — el ARCHIVO subido, que sobrevive a
--                              cualquier cambio de idea.
--
-- El centinela va en la MISMA columna que los doce a propósito: «qué
-- hay adentro del sello» es UNA pregunta con una sola respuesta, y
-- partirla en dos banderas deja estados imposibles (los dos puestos,
-- ninguno puesto) que alguien tiene que resolver en código.
--
-- ------------------------------------------------------------
-- EL CHECK CIERRA EL ÚNICO ESTADO IMPOSIBLE QUE QUEDA
-- ------------------------------------------------------------
-- 'propio' SIN archivo no significa nada: el pase saldría con círculos
-- vacíos y nadie sabría por qué. El código ya lo trata como «el logo de
-- siempre» al leer (`selloDelPase`, en src/lib/lealtad/iconos-sello.ts),
-- pero eso es la red de abajo — acá directamente no se puede guardar.
--
-- Al revés SÍ se puede: un archivo guardado con otro ícono elegido es
-- exactamente el caso de arriba (el negocio tiene su ícono subido y hoy
-- está usando «Café»).
--
-- ------------------------------------------------------------
-- RLS: NO HACE FALTA NINGUNA POLÍTICA NUEVA
-- ------------------------------------------------------------
-- Esto es una COLUMNA de `programa_lealtad`, que tiene RLS habilitada
-- desde la 0060 con sus dos políticas —«Programa activo visible para
-- todos» (lectura) y «El dueño administra su programa» (escritura)—.
-- Postgres no tiene políticas por columna: las de la tabla gobiernan
-- también lo que se agrega hoy, y quien no podía escribir la fila
-- sigue sin poder escribir esta columna.
--
-- El ARCHIVO va al bucket `ranchos-fotos`, que es público y ya tiene
-- sus cuatro políticas de storage desde la 0011 (ve cualquiera; suben,
-- reemplazan y borran las cuentas con sesión). El ícono se guarda bajo
-- `lealtad/iconos/<usuario>/…`, el mismo patrón que el logo
-- (`lealtad/logos/…`) y la banda (`lealtad/bandas/…`), así que tampoco
-- hay nada nuevo que permitir ahí.
--
-- Que la URL sea de NUESTRO storage —y no de un dominio ajeno que
-- mañana cambia la imagen del pase de un negocio— lo exigen las server
-- actions con `esUrlDeNuestroStorage`, y que el archivo sea de verdad
-- una imagen lo comprueba `comprobarImagenSubida` leyendo sus primeros
-- bytes. Un CHECK de SQL no puede mirar adentro de un archivo; lo que
-- sí puede es lo de acá abajo: que sea https y que no sea infinita.
--
-- `null` es el valor de TODOS los programas que ya existen. Ninguna
-- tarjeta emitida cambia de aspecto por esta migración.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table programa_lealtad add column if not exists pase_sello_icono_url text;

-- ------------------------------------------------------------
-- 1. La lista de la 0145, más el centinela del ícono propio
-- ------------------------------------------------------------
alter table programa_lealtad drop constraint if exists programa_lealtad_pase_sello_icono_check;
alter table programa_lealtad add constraint programa_lealtad_pase_sello_icono_check
  check (
    pase_sello_icono is null
    or pase_sello_icono in (
      'cafe', 'tijera', 'unas', 'comida', 'cerveza', 'pesa',
      'flor', 'mascota', 'auto', 'corazon', 'estrella', 'regalo',
      'propio'
    )
  );

-- ------------------------------------------------------------
-- 2. La URL: https, de largo humano
-- ------------------------------------------------------------
-- 500 es el mismo tope que aplica el código al leerla
-- (`urlDeIconoPropio`). Una URL de nuestro storage ronda los 150.
alter table programa_lealtad drop constraint if exists programa_lealtad_pase_sello_icono_url_check;
alter table programa_lealtad add constraint programa_lealtad_pase_sello_icono_url_check
  check (
    pase_sello_icono_url is null
    or (
      pase_sello_icono_url like 'https://%'
      and char_length(pase_sello_icono_url) between 12 and 500
    )
  );

-- ------------------------------------------------------------
-- 3. 'propio' sin archivo no existe
-- ------------------------------------------------------------
alter table programa_lealtad drop constraint if exists programa_lealtad_sello_propio_check;
alter table programa_lealtad add constraint programa_lealtad_sello_propio_check
  check (
    pase_sello_icono is distinct from 'propio'
    or pase_sello_icono_url is not null
  );

comment on column programa_lealtad.pase_sello_icono is
  'El dibujo que va DENTRO de cada sello (0145): cafe, tijera, unas, '
  'comida, cerveza, pesa, flor, mascota, auto, corazon, estrella, '
  'regalo. Desde la 0174 tambien puede valer ''propio'', que significa '
  '«el archivo de pase_sello_icono_url». null = el logo del negocio, '
  'que es el comportamiento anterior a la 0145. Solo lo usan las '
  'tarjetas de sellos: en los otros siete tipos no hay circulos donde '
  'dibujarlo, y el codigo lo descarta al leer la fila (`selloDelPase`). '
  'Los trazos de los doce viven en src/lib/lealtad/iconos-sello.ts, y '
  'de ahi los toman tanto el panel como el generador del pase.';

comment on column programa_lealtad.pase_sello_icono_url is
  'El icono PROPIO que subio el negocio (0174), en el bucket publico '
  'ranchos-fotos bajo lealtad/iconos/. Se dibuja adentro del circulo '
  'del sello por el mismo camino que ya usaba el logo (`selloRedondo` '
  'en src/lib/wallet/imagenes.ts): disco blanco, la imagen encajada al '
  '62%, y el sello que falta al 26% de opacidad. SOBREVIVE a que el '
  'dueno elija uno de los doce dibujos —es su archivo, no un valor '
  'temporal— y solo se borra si cambia el tipo de tarjeta, porque ahi '
  'ya no hay circulos donde dibujar nada.';
