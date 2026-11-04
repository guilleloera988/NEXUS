# Escáner antivirus de SkillPass

ClamAV (`clamd` + `freshclam`) con un frente HTTP mínimo (`server.mjs`, sin dependencias). La app manda cada
archivo de evidencia a `POST /scan` **antes** de guardarlo. Si el archivo está infectado lo rechaza y deja
registro en la bitácora. Si está limpio lo guarda y lo registra en la base de datos como revisado
(`evidence.scanned_at`, migración `20261105000001`).

- Los archivos se revisan en memoria; el servicio no los escribe a disco ni los registra (sólo veredicto, tamaño y tiempo).
- `POST /scan` exige `Authorization: Bearer <SCANNER_TOKEN>`; `GET /health` (sin token) responde 200 cuando `clamd` está listo.
- Las firmas se descargan al arrancar y `freshclam` las actualiza 12 veces al día.
- Si `clamd` o el frente HTTP se detienen, el contenedor termina y la plataforma lo reinicia.
- Memoria: unos **2 GB** (la base de firmas cargada ocupa ~1.2 GB).

## Desplegar en Fly.io (una vez)

Necesitas una cuenta en <https://fly.io> con método de pago. Una máquina siempre encendida de 2 GB cuesta
alrededor de 10–15 USD al mes; revisa la página de precios de Fly.io. Desde una terminal en esta carpeta (`scanner/`):

```bash
# 1. Instalar flyctl e iniciar sesión
curl -L https://fly.io/install.sh | sh
fly auth login

# 2. Crear la app (sin desplegar todavía). Si el nombre está ocupado, cambia `app` en fly.toml.
fly launch --copy-config --no-deploy

# 3. Token compartido con la app (guárdalo: también va en Vercel)
openssl rand -hex 32            # copia el resultado
fly secrets set SCANNER_TOKEN=<el valor>

# 4. Desplegar (la primera vez tarda unos minutos: descarga las firmas)
fly deploy

# 5. Comprobar
curl https://<tu-app>.fly.dev/health      # {"ok":true,"engine":"ClamAV 1.x/…"}
```

Después avisa a quien opera SkillPass con la URL (`https://<tu-app>.fly.dev`) y entrega el token por un canal
privado. Del lado de SkillPass hay que hacer tres cosas, en este orden:

1. Aplicar la migración `20261105000001_evidence_antivirus.sql` si aún no está (no cambia nada mientras el requisito siga apagado).
2. En Vercel (`skillpass-prod`, sólo *Production*, tipo *Sensitive*), `SCANNER_URL` y `SCANNER_TOKEN`; luego redesplegar.
   Desde ese momento la app revisa cada archivo y rechaza los infectados.
3. Guardar la compuerta y encender el requisito con el SQL que imprime
   `SCANNER_TOKEN=<el valor> node scripts/scan-gate.mjs`. A partir de entonces la base de datos rechaza archivos
   sin revisar y deja en cuarentena los que nunca se revisaron.

## Probar

- `npm test` incluye `tests/scanner-service.test.ts`: el frente HTTP contra un `clamd` simulado.
- Con el servicio desplegado se puede subir el archivo de prueba EICAR (<https://www.eicar.org/download-anti-malware-testfile/>)
  como evidencia: SkillPass debe rechazarlo con «El antivirus detectó software malicioso…».

## Cambiar el token

`fly secrets set SCANNER_TOKEN=<nuevo>`, el mismo valor en Vercel (redesplegar) y volver a correr
`scripts/scan-gate.mjs` en la base. Mientras no coincidan, las subidas fallan con «No pudimos revisar el archivo…».
