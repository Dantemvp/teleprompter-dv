# Backend de guardado en la nube (Vercel)

El sitio vive en GitHub Pages (estático). Para que el botón "☁ Guardar en la nube"
funcione, una función serverless en Vercel recibe la edición y la commitea al repo.
El token de GitHub vive en Vercel (servidor), nunca en el navegador.

## Pasos (una sola vez)

### 1. Crear un token de GitHub de acceso limitado
- GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token
- Repository access: **Only select repositories** → `Dantemvp/teleprompter-dv`
- Permissions → Repository permissions → **Contents: Read and write**
- Generar y copiar el token (empieza con `github_pat_...`)

### 2. Importar el repo en Vercel
- vercel.com → Add New → Project → Import `Dantemvp/teleprompter-dv`
- Framework preset: **Other** (es estático + carpeta `api/`)
- Deploy

### 3. Variables de entorno en Vercel (Project → Settings → Environment Variables)
- `GH_TOKEN` = el token fine-grained del paso 1
- `GH_REPO` = `Dantemvp/teleprompter-dv`
- `EDIT_PASSWORD` = la misma contraseña de edición del sitio
- (opcional) `ALLOW_ORIGIN` = `https://dantemvp.github.io`
- Redeploy para que tomen efecto.

### 4. Conectar el sitio con la función
- Copia la URL del proyecto Vercel (ej. `https://teleprompter-dv.vercel.app`)
- En `index.html`, pon en `SAVE_ENDPOINT` el valor `https://teleprompter-dv.vercel.app/api/save`
- Commit + push. Listo: el botón "☁ Guardar en la nube" aparece en el editor.

## Cómo funciona al guardar
1. El editor manda al endpoint: contraseña + cliente + slug + markdown.
2. La función valida la contraseña contra `EDIT_PASSWORD`.
3. Con `GH_TOKEN` hace commit a `clientes/<cliente>/<slug>.md`.
4. GitHub Pages reconstruye (~1 min) y el cambio queda visible para todos.

## Referencias de prendas — piloto Bianca (19 octubre 2026)

- UI: `prendas.js` + `prendas.css`, montada desde `index.html`; no modifica los markdown ni la lectura del teleprompter.
- API: `/api/prendas`, con imágenes y manifiestos en Vercel Blob **privado**. Nunca guardar fotos en este repositorio público.
- Variables adicionales: `BLOB_READ_WRITE_TOKEN` (almacén privado vinculado) y `PRENDAS_SECRET` (firma de enlaces, secreto sólo del servidor). Configurarlas en cada entorno donde se use el piloto; producción está configurada.
- Dante entra en modo edición y usa su contraseña habitual de escritura. Dentro de un guion: **Prendas y referencias → Agregar prenda**. El nombre se vuelve pulsable cuando coincide con el texto del guion.
- Desde esa sección genera enlaces para Bianca, empleadas o editor. Son accesos por enlace, no cuentas personales: caducan a los 180 días y dan acceso a las referencias de Bianca. Compartir sólo con el destinatario del rol correspondiente. Rotar `PRENDAS_SECRET` invalida todos los enlaces.
- Empleadas y Bianca pueden agregar prendas y fotos. Sólo Bianca/Dante pueden marcar **Usar esta**; el editor sólo consulta. Se permiten varias imágenes seleccionadas por prenda.
- **Tomar foto** abre la cámara en dispositivos compatibles; **Subir fotos o capturas** abre la galería. Se comprimen y guardan automáticamente al elegirlas. Máximo 12 imágenes por prenda, 40 prendas por guion. HEIC depende del soporte de decodificación del navegador; JPG/PNG/WebP son seguros.
- Las fotos se sirven mediante la API autenticada, con caché privada y sin referrer. Los manifiestos se actualizan con ETag y reintentos para evitar pérdida de cambios simultáneos.
- Pruebas de lógica/permisos: `npm test`. Servidor de comprobación local: `node --env-file=.env.local scripts/prendas-dev.mjs` (credenciales ficticias sólo para localhost; usa el almacén vinculado, no subir datos de prueba permanentes).
- No incluye integración con POE, avisos push ni aprobación de videos; es exclusivamente una herramienta de referencias para los guiones de Bianca.
