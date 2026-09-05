# Handoff: Claude → Codex · 2026-09-03

Documento de sincronización. Codex: léelo completo antes de tocar nada.
Yo soy el agente Claude que trabaja en sesiones remotas (Claude Code on the web).

---

## 1. ESTADO ACTUAL — qué existe y dónde

Hay tres ubicaciones. **Ninguna es todavía el repo central**, y eso es el
primer problema a resolver.

### A. `Dantemvp/teleprompter-dv` — rama `claude/web-pages-seo-aeo-2c0pa8`
Carpeta `geo-aeo/`. Es donde vive todo lo mío por ahora, **provisionalmente**:
- `01-base-conocimiento.md` — investigación GEO/AEO v1. 12 hallazgos con fuente.
  Incluye la sección 3.1 que separa `robots.txt` (palanca real) de `llms.txt`
  (sin evidencia).
- `PROMPT-CODEX.md` — el brief original con el que arrancaste.
- `clients/fedra-aldama.md`
- `clients/dentisania-ale-paz.md`
- `clients/draalepaz-auditoria-preliminar.md` — auditoría en dos pasadas.
- `clients/referencias.md` — URLs de clientes + ficha de TSC Labs.

### B. `Dantemvp/dentisania-web` — rama `claude/geo-aeo-fixes` (commit `b37e692`)
**Código de producción ya modificado y verificado.** Sitio de la Dra. Alejandra
Paz (draalepaz.com). Astro 7 SSG. Ver sección 2.

### C. Tu trabajo local — rama `codex/ops-colaboracion`
Sin pushear al momento de escribir esto. Contiene `AGENTS.md`, `CLAUDE.md`,
`COLLABORATION.md`, `DECISIONS.md`, `STATUS.md`, `handoffs/`, `reviews/`,
`.github/pull_request_template.md`.

---

## 2. QUÉ HICE EN `dentisania-web` (commit `b37e692`)

Auditoría desde código fuente + fixes aplicados. Build verificado:
**33 páginas, 31 con JSON-LD, 0 referencias colgantes, `@graph` plano en todas.**

### Bugs reales encontrados y corregidos
1. **`graph([a, b])` sobre un rest param** en `evaluacion`, `precios`,
   `tecnologia` y `primera-visita` → producía `@graph: [[a, b]]`.
   **JSON-LD inválido en 4 de 11 páginas.** Corregidos los call sites y
   `graph()` ahora aplana defensivamente.
2. **`isPartOf` colgante**: `articleSchema()` apuntaba a `<url>/#website`,
   un `@id` que no existía. Añadido `websiteSchema()`, inyectado siempre.
3. **`employee`/`founder` colgantes**: las páginas que emitían el negocio sin
   el nodo de la Dra. dejaban esas referencias sin resolver. Cinco páginas.

### Refuerzos de entidad
4. `sameAs` en el `Person` de la Dra. (Instagram, TikTok, Doctoralia). Antes
   la doctora del sitio y la de sus perfiles eran entidades separadas.
5. Cédula de especialidad con `url` al Registro Nacional de Profesionistas
   (SEP) → afirmación que pasa a credencial verificable.
6. Nuevo `surgeonSchema()` para el Dr. Carlos Nuño Castro (cirujano
   maxilofacial, 2 cédulas SEP, Doctoralia). Estaba en el config y visible en
   las páginas, pero no existía como entidad.

### Contenido
7. `cuanto-cuesta-ortodoncia-guadalajara.mdx`: **ahora responde su propia
   pregunta.** Abre con la cifra, tabla comparativa por técnica, FAQ con el
   número. Antes era una página titulada "cuánto cuesta" que no daba ninguna
   cifra — incitable para su propia consulta.
8. Nuevo `como-elegir-dentista-guadalajara-zapopan.mdx`: 7 criterios
   verificables. Ataca "dentistas en gdl", "dentistas en zapopan", "cuál es el
   mejor dentista". La primera FAQ responde literal "¿cuál es el mejor
   dentista en Guadalajara?" con criterios, no autoproclamándose.

### ⚠️ RIESGO ABIERTO — decisión de Dante, no nuestra
`src/data/market.ts` dice literalmente: *"Versión de prueba. Números de
REFERENCIA del mercado dental de Guadalajara/Zapopan, NO precios oficiales de
la clínica."* **Esos placeholders están publicados en vivo en `/precios`**, y
yo amplifiqué el de ortodoncia ($14,900) al artículo para no tener dos cifras
distintas en el mismo sitio. Son precios sin confirmar en la web de un
consultorio médico. **No lo tapes ni lo repliques a otros clientes hasta que
Dante confirme las cifras reales.** Se cambia solo en `market.ts`.

---

## 3. LO QUE NECESITO DE TI — en este orden

### P0 — Decidir el repo central y consolidar
`add_repo` en mis sesiones **no acepta repos de otro owner** si la sesión ya
tiene repos de `Dantemvp`. Por eso:
- **Crea el repo central bajo `Dantemvp`, no bajo `Consultora-DV`.**
  Sugerencia de nombre: `Dantemvp/geo-aeo-lab`.
- Pushea ahí tu rama `codex/ops-colaboracion`.
- Mueve mi carpeta `geo-aeo/` de `teleprompter-dv` a ese repo (`teleprompter-dv`
  es un teleprompter de guiones, no tiene nada que ver; está ahí solo porque
  fue el único repo al que tuve acceso al arrancar).
- Confírmame el nombre en `STATUS.md` para que yo lo enganche.

### P0 — `tools/fetch-site`
Es lo que me desbloquea. **Yo no tengo acceso a red**: el proxy de mis sesiones
bloquea el fetch de cualquier URL (probé arxiv, Google Developers, YouTube,
Instagram, hasta `dantemvp.github.io` — todo `EGRESS_BLOCKED`). Solo me
funciona la búsqueda web, y está limitada a resultados de EE.UU., así que se le
escapan los negocios locales mexicanos.

Necesito que descargues y **persistas en el repo**:
- HTML crudo con user-agent de `GPTBot`, `OAI-SearchBot`, `PerplexityBot`,
  `ClaudeBot`, `Googlebot` y navegador normal — **cada variante por separado**.
- La versión renderizada con Playwright, y **el diff contra el HTML crudo**.
  Ese diff es el hallazgo más valioso de una auditoría: es el contenido que
  no existe para los motores de IA.
- `robots.txt`, `llms.txt`, `sitemap.xml`, headers HTTP completos, redirects.
- Todo en `audits/<cliente>/<fecha>/raw/` con manifiesto.

Con eso yo audito offline. Sin eso, solo puedo auditar sitios cuyo código
fuente esté en GitHub bajo `Dantemvp`.

### P1 — Extracción de TSC Labs (`https://tsc-labs.com.mx/`)
Es el caso que originó el proyecto y sigue sin resolverse. El socio de Dante
atribuye su salto de leads a `robots.txt` + `llms.txt`. Mi lectura, con la
evidencia que junté: **`llms.txt` no tiene evidencia de funcionar** (Google
dijo en may-2026 que no lo usa; SE Ranking probó sobre 300k dominios y quitar
la variable mejoró la predicción). `robots.txt` **sí** es palanca real, pero
solo si antes estaba bloqueando.

Necesito que resuelvas esto empíricamente:
- `robots.txt` actual **y su histórico en Wayback Machine**. Si antes bloqueaba
  crawlers de IA, caso cerrado: el mérito es de haber dejado de bloquear.
- Fecha de aparición del `llms.txt`.
- Si el HTML es server-rendered o depende de JS.
- Schema que emite.
- Menciones de terceros aparecidas en la ventana del salto (el confundidor
  más probable).

**No des el veredicto sin los cuatro datos.** Es la diferencia entre vender un
servicio con base y vender cargo cult.

### P1 — Auditar `drafedraaldama.com`
Está en `Consultora-DV/drafedraaldama` y **yo no puedo engancharlo** (mismo
límite de owner). Es todo tuyo. Empieza por lo mismo que Dentisania:
`graph()` mal llamado, referencias colgantes, `sameAs` en el `Person`,
credenciales verificables. Sus datos (cédula 11015233, COFEPRIS
2425012002A00026, NAP completo) están en `geo-aeo/clients/fedra-aldama.md`,
extraídos de sus perfiles públicos — **valídalos antes de publicarlos**.

### P2 — Panel de prompts
Set inicial que propongo para Dentisania (es-MX, Zapopan/GDL):
- "mejor ortodoncista en Zapopan"
- "dentistas en Guadalajara"
- "cuánto cuesta la ortodoncia en Guadalajara"
- "alineadores invisibles Guadalajara precio"
- "ortodoncista que también haga cirugía maxilofacial en GDL"
- "cómo elegir dentista en Zapopan"
Línea base **antes** de que se despliegue `claude/geo-aeo-fixes`, para poder
atribuir. Si ya se desplegó, mídelo igual y anótalo como línea base tardía.

---

## 4. REGLAS PARA NO CHOCAR

| Área | Dueño | Nota |
|---|---|---|
| Investigación, fuentes, `kb/` | **Codex** | Tienes red; yo no |
| `tools/` (fetch, audit, panel) | **Codex** | |
| TSC Labs y verificación causal | **Codex** | |
| Repos bajo `Consultora-DV` | **Codex** | Yo no puedo engancharlos |
| Código de sitios bajo `Dantemvp` | **Claude** | Ya tengo `dentisania-web` |
| Auditoría desde código fuente | **Claude** | |
| Redacción de contenido y entregables | **Claude** | |
| `LEDGER.md`, `STATUS.md` | **Ambos** | Append, nunca reescribir |
| Archivos de proceso (`AGENTS`, `COLLABORATION`, plantillas) | **Codex** | Ya están hechos; **no los sigas puliendo** |

Ramas: `codex/<área>` y `claude/<área>`. Nunca a `main` directo.
Si encuentras que algo mío está mal, **corrígelo y anótalo en el LEDGER como
refutación**. No lo dejes pasar por cortesía; yo haré lo mismo contigo.

---

## 5. UNA OBSERVACIÓN QUE TE VA A AHORRAR TOKENS

Tu primera sesión se fue completa en construir la capa de proceso —
`AGENTS.md`, `COLLABORATION.md`, `STATUS.md`, `handoffs/`, `reviews/`,
plantillas de PR — y se quedó sin presupuesto antes de producir un solo
hallazgo de investigación o una herramienta.

Parte es culpa del brief que yo escribí: puse "bootstrap del repo" como fase 1
pensando en cinco archivos. Salió una burocracia de coordinación para un equipo
de dos agentes.

Lo hecho, hecho está y algo sirve. Pero **no sigas ahí**. El riesgo real de
este proyecto no es la falta de protocolo: es terminar con un repo impecable,
perfectamente documentado, y cero hallazgos que le sirvan a Ale Paz o a Fedra.
Ve directo a `fetch-site` y a TSC Labs.

---

## 6. PENDIENTES DE DANTE (no nos bloquean, pero anótalos)
- [ ] **Confirmar los precios reales** de Dentisania → `market.ts`. Prioridad alta.
- [ ] Reclamar el perfil de **Doctoralia** de la Dra. Paz. Es la acción
      individual de mayor retorno de todo el proyecto y no es código.
- [ ] Llenar `reviews.ratingValue` / `reviewCount` con datos reales del GBP.
- [ ] `cedulaLicenciatura` y `email` siguen como `TODO_DANTE` en `site.ts`.
- [ ] Validar con la Dra. Fedra sus datos antes de publicarlos en schema.
- [ ] Accesos: GA4, Search Console y logs de servidor de ambos sitios.

## 7. LO QUE YO NO HE REVISADO DE DENTISANIA
Para que no asumas que está cerrado:
- `src/data/services.ts` (37 KB) — el grueso del contenido de servicios.
- Los otros 11 artículos del blog con el criterio de "¿responde su título?".
- `updatedDate`: solo lo puse en los 2 artículos que toqué; los demás siguen
  congelados en su fecha de publicación (`dateModified` == `datePublished`).
- Comportamiento en producción: edge, headers, indexación real.
