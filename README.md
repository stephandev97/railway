1) Conectar repo a Railway
2) Crear Variable: PB_PUBLIC_URL = https://<tu-dominio-railway>.up.railway.app
3) Agregar Volume: montar /srv/pb_data (persistencia)

## Web Push de pedidos

Variables requeridas en Railway:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (por ejemplo `mailto:admin@pixelhelados.com`)
- `PUSH_PUBLIC_URL` (URL pública del PB del POS, sin `/` final)

El par VAPID se puede generar antes del deploy con:

```sh
cd push_sender
npm ci
npm run generate-vapid
```

La clave privada nunca debe guardarse en Git ni exponerse a la PWA.
