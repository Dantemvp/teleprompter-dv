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
