# Activar puntos de prueba (PocketBase 0.22.x)

## Variables de Railway

- Ambos backends: `POINTS_BRIDGE_SECRET`, el mismo secreto aleatorio de al menos
  32 bytes. Nunca en Git ni en variables `VITE_*`.
- Backend PWA: `TEST_POINTS_ADMIN_EMAIL`, correo exacto del admin autorizado.
- Backend POS: `PWA_POINTS_URL=https://pb.pixelhelados.com`.

## Antes de desplegar

Hacer y descargar backups de ambas bases. Confirmar los volúmenes existentes
sin modificar sus rutas. Los hooks usan la API de PocketBase 0.22 (POS 0.22.14,
PWA 0.22.20); no actualizar a 0.23+ sin migrarlos.

Verificar la colección REAL `points_transactions`: `client`, `points`, `type`
(select con `earn`, `compra` o `earned`), y `description` o `notes` de texto.
Si existen ambos campos de texto, se usa `description`. Revisar también otros
campos obligatorios personalizados. No abrir las reglas de saldo al público.

## Orden de despliegue

1. Backend PWA: el Dockerfile ahora copia todos los hooks.
2. Backend POS.
3. Frontend PWA: deja de escribir historial/saldo y consulta la acreditación.

Esto SOLO acredita `orders_test` de origen app con marcador
`test:CLIENT_ID:TIMESTAMP`, finalizados (`delivered` o `pickedup`) y puntos
positivos. Conserva el flujo existente de pedidos normales para no duplicarlo.

El POS envía el cliente y puntos del registro guardado mediante un endpoint
HTTPS protegido por el secreto compartido. Por eso las reglas de pedidos deben
impedir que usuarios no autorizados falsifiquen propietario, puntos o estado.
El receptor limita además el cliente al correo admin configurado.

El receptor crea el historial y suma el saldo en una transacción SQLite, buscando
el marcador `Pedido de prueba admin [orders_test:ID]` para evitar duplicados.
El POS marca `pointsClaimed` tras recibir confirmación. Reintenta cada minuto,
hasta 20 pendientes por tanda, incluyendo pedidos históricos no acreditados.
Un fallo de puntos no revierte la entrega.

## Verificación obligatoria en staging

- Finalizar sin abrir la PWA: verificar saldo, historial y pointsClaimed.
- Repetir la actualización: solo un incremento y una transacción.
- Interrumpir el receptor y restaurarlo: el cron debe recuperar la acreditación.
- Secretos distintos/cuenta no autorizada: no acreditar.
- Pedido real: este hook no debe intervenir.
- Revisar logs `[test points]` en ambos servicios.

No se desplegaron cambios ni se probaron contra producción. Para desactivar
el envío quitar `PWA_POINTS_URL` del POS; los pendientes se conservan.
