# Persistencia y recuperación del POS

PocketBase debe ejecutarse con `--dir=/srv/pb_data` y el volumen real de Railway
debe estar conectado a ese mismo servicio y montado en `/srv/pb_data`.
La configuración del repositorio NO prueba que ese volumen exista en producción.

## Antes de desplegar o modificar el volumen

1. Confirmar en Railway el servicio, entorno y Mount Path del volumen existente.
2. Crear un backup desde Settings > Backups de PocketBase y descargarlo fuera
   del servidor. Guardar también un backup del volumen cuando esté disponible.
3. Verificar que el backup pueda restaurarse en una instancia aislada usando
   la misma versión de PocketBase (actualmente 0.22.14).
4. No borrar ni reemplazar el volumen existente. No montar un volumen vacío
   encima de la carpeta de datos actual sin respaldar y migrar previamente.

## Qué debe conservarse

Conservar toda la carpeta `pb_data`, no solo `data.db`: incluye la base de datos,
archivos subidos y otros datos administrados por PocketBase. Si hay almacenamiento
externo configurado, respaldarlo también. No copiar SQLite en caliente con una
copia simple: usar el backup de PocketBase o detener el proceso para una copia
consistente de toda la carpeta.

Los hooks se despliegan desde `pb_hooks` en Git, fuera del volumen de datos.
Conservar las variables y secretos de Railway de forma segura por separado,
incluida cualquier clave de cifrado configurada. No subir datos ni secretos a Git.

## Recuperar

- Si se reemplaza solo el contenedor: reutilizar el volumen existente, en la
  misma ruta, y desplegar el código de este repositorio.
- Si se pierde el volumen: crear otro, restaurar el backup siguiendo el proceso
  de PocketBase y verificar colecciones, pedidos y archivos antes de habilitar
  el POS. Sin un backup externo no hay garantía de recuperación.

## Verificación de producción pendiente

Este repositorio no contiene los datos de producción. Confirmar el volumen y
los backups en Railway antes de considerar verificada la persistencia.
