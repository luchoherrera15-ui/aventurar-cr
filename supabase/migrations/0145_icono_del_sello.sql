-- ============================================================
-- BOOKEA — El icono del sello (0145)
--
-- Qué se dibuja adentro de cada círculo de una tarjeta de sellos.
--
-- ------------------------------------------------------------
-- POR QUÉ HACE FALTA
-- ------------------------------------------------------------
-- Hasta hoy el sello era SIEMPRE el logo del negocio recortado en un
-- círculo (`selloRedondo`, en src/lib/wallet/imagenes.ts). Eso sirve
-- cuando el logo es un símbolo compacto, y falla justo con quien más
-- usa una tarjeta de sellos:
--
--   · la soda o la barbería que no tiene logo bueno —una foto del
--     rótulo, el nombre escrito— y a 30 píxeles no se distingue nada;
--   · la marca de logo BLANCO, que sobre el círculo blanco del sello
--     desaparece entera. Ese caso ya nos costó pases sin `strip.png`
--     (ver src/lib/wallet/escalones-tira.ts).
--
-- Con un icono elegido de una lista corta, el sello es un dibujo hecho
-- para verse chiquito, y el logo del negocio sigue estando arriba del
-- pase, que es donde identifica.
--
-- ------------------------------------------------------------
-- POR QUÉ UNA COLUMNA Y NO UN CAMPO DENTRO DE `beneficio`
-- ------------------------------------------------------------
-- Porque no es configuración del TIPO: es APARIENCIA del pase, igual
-- que `pase_color_fondo`, `pase_color_sello` o `pase_logo_url`, y vive
-- con ellas. En el jsonb quedaría fuera del alcance de un CHECK y al
-- lado de datos que significan otra cosa.
--
-- ------------------------------------------------------------
-- EL CHECK ES LA LISTA, Y LA LISTA TAMBIÉN VIVE EN CÓDIGO
-- ------------------------------------------------------------
-- Los doce ids son los de `ICONOS_SELLO_ID` en
-- src/lib/lealtad/iconos-sello.ts, que es donde están los dibujos. El
-- servidor ya rechaza cualquier otro con un mensaje en español
-- (`esIconoSello`); este CHECK es el piso: lo que ninguna petición
-- armada a mano puede saltarse.
--
-- Si algún día se agrega un icono trece, hay que tocar los dos lados —
-- y es a propósito: el día que la base acepte un id que el código no
-- sabe dibujar, el sello sale vacío en el teléfono de un cliente.
--
-- `null` es un valor legítimo y es el de todos los programas que ya
-- existen: significa «el logo del negocio», o sea el comportamiento de
-- siempre. Ninguna tarjeta emitida cambia de aspecto por esta
-- migración.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table programa_lealtad add column if not exists pase_sello_icono text;

alter table programa_lealtad drop constraint if exists programa_lealtad_pase_sello_icono_check;
alter table programa_lealtad add constraint programa_lealtad_pase_sello_icono_check
  check (
    pase_sello_icono is null
    or pase_sello_icono in (
      'cafe', 'tijera', 'unas', 'comida', 'cerveza', 'pesa',
      'flor', 'mascota', 'auto', 'corazon', 'estrella', 'regalo'
    )
  );

comment on column programa_lealtad.pase_sello_icono is
  'El dibujo que va DENTRO de cada sello (0145): cafe, tijera, unas, '
  'comida, cerveza, pesa, flor, mascota, auto, corazon, estrella, '
  'regalo. null = el logo del negocio, que es el comportamiento '
  'anterior a esta migración. Solo lo usan las tarjetas de sellos: en '
  'los otros siete tipos no hay círculos donde dibujarlo, y el código '
  'lo descarta al leer la fila (`iconoDelSello`). Los trazos de cada '
  'icono viven en src/lib/lealtad/iconos-sello.ts, y de ahí los toman '
  'tanto el panel como el generador del pase de Apple.';
