-- ============================================================
-- "Invitación Esencial" pasa a llamarse "Invitación Estándar"
-- (pedido del dueño: es el primer tipo de invitación de boda).
--
-- Solo cambia el NOMBRE: el id `inv_esencial` se queda porque los
-- pedidos ya hechos lo referencian y nunca se muestra en pantalla.
-- El precio no se toca. Es seguro correrla varias veces.
-- ============================================================

update paquetes_invitacion
set nombre = 'Invitación Estándar'
where id = 'inv_esencial';
