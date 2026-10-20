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

### Revisión de usabilidad — 20 octubre 2026

- `prendas-detect.js` reconoce nombres comunes y materiales en cualquier guion de Bianca. Son sugerencias locales: no se crean registros ni se aprueba una prenda por detectarla. Se conserva el registro al aportar su primera foto. También se puede agregar una referencia manualmente si la detección no la encuentra.
- Los nombres se marcan dentro de la conversación sin alterar indicaciones, texto plano ni lectura de teleprompter. El resumen compacto está al inicio de la conversación, plegado por defecto, con fotos y estados visuales al abrirlo.
- Un toque en la prenda abre cámara/galería primero. Las opciones de nombre/indicación previas son opcionales y plegadas; la carga guarda sin otro botón. Los reintentos conservan el ID para evitar duplicados.
- Fotos elegidas y propuestas se muestran por separado. Bianca/Dante pueden editar la indicación de una foto después de subirla; se guarda al salir del campo. El editor entra con el filtro de fotos elegidas y no tiene controles de escritura.
- Los guardados de la misma pantalla se serializan y los conflictos entre personas se reintentan con ETag usando la clase real del SDK, no `error.name`.
- Pruebas locales usan exclusivamente `prendas-qa/`, nunca `prendas/`. Ese espacio sólo puede activarse fuera de producción desde el servidor de pruebas. La imagen SVG de `tests/` se usa como entrada de galería, el navegador la transforma a JPEG antes de enviarla; la API sigue rechazando SVG directo.

### Cobertura R12–R18 y retirada de fotos — 19 octubre 2026

- Auditoría: 117 piezas en las siete grabaciones (68 archivos de guion y 49 tarjetas de referencia). Las tarjetas sin markdown tienen ahora vista interna con su información y enlace original; no se fabrican transcripciones. La API verifica también que esas tarjetas existan en el índice antes de permitir adjuntar prendas.
- Los accesos internos y la navegación entre grabaciones conservan el enlace de referencias del rol. No se cambia el rol ni se hace pública la carga de imágenes.
- Subrayado rojo: ninguna foto activa. Verde: una o más fotos cargadas, aunque aún no estén elegidas. Retirar la última foto devuelve el rojo. La selección para edición es un estado independiente.
- Borrado propio: hasta cinco minutos desde la fecha de subida del servidor, desde el mismo navegador. Un secreto aleatorio local se envía por cabecera; sólo su SHA-256 se guarda junto a la foto. Ni el secreto ni el hash se devuelven en el manifiesto público autenticado. No se atribuye propiedad por el nombre escrito ni por compartir el enlace de tienda.
- Las fotos previas sin identificador de propietario sólo puede retirarlas el administrador. Al expirar el plazo, el servidor rechaza el borrado propio aunque se manipule el botón o el reloj local. El administrador puede retirar en cualquier momento.
- La retirada es reversible: las fotos desaparecen de la lectura y de las URLs autenticadas del cliente/editor, pero el administrador puede recuperarlas en **Fotos retiradas**. No se elimina el blob original ni se tocan guiones, estados de grabación o puntajes del POE.
- El estado se refresca al volver a la pestaña y cada 30 segundos mientras esté visible, sin interrumpir un modal abierto.
- Regresión real aislada: `node --env-file=.env.local scripts/prendas-lifecycle-check.mjs`. Verifica tarjeta sin markdown, propiedad, vencimiento, permisos, retirada, bloqueo de lectura y recuperación; limpia únicamente sus archivos de prueba.

### Enlaces existentes sin contraseña — 20 octubre 2026

- Los enlaces normales de Bianca `?c=bianca-ald-7q2vd&g=...` permiten consultar y aportar referencias sin cuenta, PIN ni parámetro nuevo. Se aplica a las piezas activas del índice, incluidas referencias y versiones registradas; no a borradores arbitrarios ni otros clientes.
- El servidor valida que la pieza esté activa y concede internamente un acceso de colaboradora limitado a ese guion. No se añade a la URL ni se necesita reenviar el enlace. Cualquier persona que tenga un enlace normal puede ver y aportar referencias en esa pieza: es el alcance público solicitado por Dante.
- Los accesos de contribución no pueden aprobar fotos, modificar indicaciones ajenas, generar accesos privilegiados ni borrar fotos de otras personas. Conservan el borrado propio por cinco minutos desde el navegador de subida. Los controles de Bianca y administrador mantienen su autenticación.
- Los enlaces explícitos por rol conservan sus permisos. Un enlace normal no hereda por accidente un antiguo acceso de sólo lectura guardado en la sesión. Las URLs de medios nuevas también se firman para un único guion.
- Pruebas de regresión de carga pública: el script de ciclo de vida ahora arranca sin credenciales y obtiene su acceso internamente como el navegador. Verificar además g-138, g-141 y g-140 sin `prendas=` en Vercel y Pages.
