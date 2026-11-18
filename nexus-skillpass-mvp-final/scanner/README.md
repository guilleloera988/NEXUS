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

Necesitas una cuenta en <https://fly.io> con tarjeta registrada (*Billing*). Una máquina siempre encendida de
2 GB cuesta alrededor de 10–15 USD al mes; revisa la página de precios de Fly.io.

1. **Descarga esta carpeta.** En GitHub, en la rama `claude/aindev-nexus-skillpass-mvp-khihxn`, *Code → Download ZIP*.
   Descomprime y ubica la carpeta `nexus-skillpass-mvp-final/scanner`.
2. **Abre una terminal en esa carpeta.** Windows: en el Explorador, entra a `scanner`, escribe `powershell` en la barra
   de direcciones y pulsa Enter. Mac: Terminal y `cd` a la carpeta.
3. **Instala `flyctl` e inicia sesión** (cierra y vuelve a abrir la terminal después de instalar):
   - Windows (PowerShell): `iwr https://fly.io/install.ps1 -useb | iex`
   - Mac: `brew install flyctl` (o `curl -L https://fly.io/install.sh | sh`)
   - Luego: `fly auth login` (abre el navegador para entrar).
4. **Crea la app.** `fly apps create skillpass-scanner-aindev`. Si el nombre está ocupado, usa otro y cámbialo también
   en la línea `app = …` de `fly.toml`.
5. **Genera el token** (una contraseña larga que comparten la app y el escáner) y guárdalo en Fly:
   - Windows (PowerShell): `$t = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'); $t`
   - Mac: `t=$(openssl rand -hex 32); echo $t`
   - Copia el valor que aparece y guárdalo en tu gestor de contraseñas. Luego:
     `fly secrets set SCANNER_TOKEN=<el valor> --stage`
6. **Despliega.** `fly deploy`. La primera vez tarda unos minutos: construye la imagen y descarga las firmas.
7. **Comprueba** en el navegador: `https://skillpass-scanner-aindev.fly.dev/health` debe responder
   `{"ok":true,"engine":"ClamAV …"}`. Si dice `unavailable`, espera 5 minutos y recarga (todavía carga las firmas).
8. **Guarda el mismo token en Vercel.** Proyecto `skillpass-prod` → *Settings → Environment Variables → Add*:
   nombre `SCANNER_TOKEN`, el mismo valor, sólo *Production*, marca *Sensitive* y guarda. No hace falta redesplegar.

Después avisa a quien opera SkillPass con la URL del escáner. El token **no** se manda por chat ni correo: ya está en Fly
y en Vercel. Del lado de SkillPass falta:

1. `SCANNER_URL` en Vercel (`skillpass-prod`, *Production*) con la URL del escáner, y redesplegar. Desde ese momento la
   app revisa cada archivo y rechaza los infectados.
2. `SCAN_GATE_SECRET` en Vercel (sólo *Production*, *Sensitive*): otra llave larga que **no** se comparte con el
   escáner. Con ella la app certifica ante la base de datos que revisó cada archivo.
3. Guardar la compuerta y encender el requisito con el SQL que imprime
   `SCAN_GATE_SECRET=<el valor> node scripts/scan-gate.mjs`. A partir de entonces la base de datos rechaza archivos
   sin revisar y deja en cuarentena los que nunca se revisaron. (La migración `20261105000001` ya está aplicada en
   producción.)

## Probar

- `npm test` incluye `tests/scanner-service.test.ts`: el frente HTTP contra un `clamd` simulado.
- Con el servicio desplegado se puede subir el archivo de prueba EICAR (<https://www.eicar.org/download-anti-malware-testfile/>)
  como evidencia: SkillPass debe rechazarlo con «El antivirus detectó software malicioso…».

## Cambiar el token

`fly secrets set SCANNER_TOKEN=<nuevo>` y el mismo valor en Vercel (redesplegar). Mientras no coincidan, las subidas
fallan con «No pudimos revisar el archivo…». `SCAN_GATE_SECRET` es aparte: si cambia, hay que volver a correr
`scripts/scan-gate.mjs` en la base.
