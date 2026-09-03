# Base de conocimiento GEO / AEO — v1 (sep 2026)

Documento de trabajo interno. Objetivo: tener criterio propio antes de vender
auditorías. Todo lo que dice "evidencia débil" es marketing de agencias, no dato.

---

## 1. Definiciones útiles (y por qué la sopa de siglas no importa)

- **AEO** (Answer Engine Optimization): que tu contenido sea *extraíble* como
  respuesta directa. Es un problema de **formato y estructura**.
- **GEO** (Generative Engine Optimization): que el modelo te **cite y recomiende**
  en su respuesta sintetizada. Es un problema de **autoridad y presencia de entidad**.
- **AI Overviews / AI Mode / ChatGPT Search / Perplexity**: superficies distintas,
  con índices y criterios distintos. No hay una sola palanca.

En la práctica son el mismo trabajo con dos mitades: **onpage (extractable)** +
**offpage (citable)**. Vender "GEO" como si fuera un producto nuevo es humo; lo
nuevo es *qué* se optimiza y *cómo se mide*.

---

## 2. Cómo funciona realmente la recuperación (esto es lo que hay que atacar)

### 2.1 Query fan-out
Google AI Mode descompone el prompt en 8–15 sub-consultas ocultas, recupera en
paralelo, y arma la respuesta con pasajes de páginas que rankean **en el conjunto
oculto**, no en la query visible. Consecuencia práctica: se optimiza para el
*abanico* de preguntas satélite, no para un keyword.
> Dato: páginas que rankean en queries del fan-out tienen ~161% más probabilidad
> de ser citadas que las que solo rankean en la query visible.

### 2.2 Recuperación a nivel de pasaje (chunking)
Los documentos se parten en chunks semánticos de ~200–500 tokens y **cada chunk
compite solo**. Un párrafo que necesita el contexto de arriba para entenderse,
no se cita.
- Regla operativa: **la primera frase de cada sección debe poder responder sola**
  a una pregunta (pirámide invertida).
- Respuesta directa de **40–80 palabras** debajo de cada H2/H3.
- Heading redactado como **la pregunta literal** = señal de match más fuerte y
  define el límite de extracción del chunk.

### 2.3 Los crawlers de IA NO ejecutan JavaScript
GPTBot, ClaudeBot, OAI-SearchBot, PerplexityBot leen **HTML crudo**, con timeouts
de 1–5s y **sin reintento**. Googlebot sí renderiza; ellos no.
> Onely (feb 2026): ~42% del contenido renderizado por JS nunca llega a sistemas de IA.

Esto es probablemente **el hallazgo #1 para auditoría técnica**: sitios en React/Vue/
Webflow con contenido inyectado, acordeones que cargan por JS, tabs, "ver más",
contenido en `<script>` de un framework → invisibles.

Test rápido: `curl -A "GPTBot" -s URL | wc -c` y buscar el texto clave en el HTML crudo.

### 2.4 Índices distintos por plataforma
- **ChatGPT**: índice propio vía OAI-SearchBot + partners. La alineación con Bing
  cayó fuerte; solo ~10% de las URLs citadas rankean en top-10 de Google. O sea:
  **estar en top de Google no garantiza nada**.
- **GPTBot ≠ OAI-SearchBot**: GPTBot es entrenamiento, OAI-SearchBot es búsqueda.
  Bloquear GPTBot NO te saca de ChatGPT Search; bloquear OAI-SearchBot sí.
- **Perplexity**: fuertemente sesgado a Reddit (hasta ~47% de citas top-10 en
  algunos estudios) y a contenido reciente (<30 días pesa ~3.2x).
- **AI Overviews / Gemini**: Reddit, YouTube, LinkedIn, Wikipedia y prensa en top.

---

## 3. Los 4 pilares de una auditoría GEO/AEO

### Pilar 1 — ACCESO (¿pueden leerte?)
Tres capas que deben estar alineadas: **robots.txt**, **el edge** (Cloudflare/WAF/
Fastly) y **bloqueo a nivel app**.
- Cloudflare bloquea por default crawlers de IA "mixed-use" en dominios nuevos
  (política vigente desde sep 2026). Muchos sitios se auto-bloquean **sin saberlo**.
  → Revisar AI Crawl Control / Bot Fight Mode.
- Verificar en logs qué bots entran de verdad.
- HTML server-side, sitemap, canonicals, status 200, sin muros de cookies que
  tapen el contenido.

### Pilar 2 — EXTRACTABILIDAD (¿pueden citarte?)
- Answer-first por sección (40–80 palabras).
- Jerarquía de headings limpia y secuencial; headings como preguntas.
- Listas y **tablas comparativas** (80% de páginas citadas usan listas; las tablas
  con datos actuales son de lo más citable).
- Estadísticas con **fuente nombrada y enlazada** al emisor primario (INEGI, OMS,
  Statista, etc.). Es la palanca #1 del paper de Princeton.
- Citas textuales de expertos.
- Fecha visible + `dateModified` real.
- Schema que **coincida con el contenido visible** (si no coincide, penaliza).

### Pilar 3 — ENTIDAD (¿saben quién eres?)
- `Organization` + `sameAs` a perfiles, Wikipedia/Wikidata, directorios.
- `Person` + `knowsAbout` para el experto (clave en médicos).
- `@id` consistente entre páginas; una "entity home" (página /about robusta).
- Consistencia de NAP (nombre, dirección, teléfono) en toda la web.
- Descripción de marca idéntica en todos lados: los modelos reconcilian entidades
  cruzando fuentes; si te describes distinto en cada sitio, no te consolidan.

### Pilar 4 — OFF-SITE (¿otros hablan de ti?)
Es el pilar que más pesa y el que casi nadie audita.
> Averi.ai: menciones de marca correlacionan **0.664** con probabilidad de cita;
> backlinks solo **0.218**. **85% de las menciones de marca en respuestas de IA
> vienen de páginas de terceros**, no de tu sitio.
- Listicles "mejores X en Y": hasta **50%** de las citas top (Seer, Q1 2026).
- Reviews, directorios (57% de citas de marca vienen de reviews/social proof,
  17% de directorios), Reddit, YouTube, prensa, podcasts.
- Orden de prioridad práctico: entity home → Wikidata → sameAs → menciones en
  listicles/directorios/prensa → Reddit/YouTube.

### Medición (sin esto no hay proyecto, hay opinión)
- **GA4**: canal "AI Assistant" (nativo desde may 2026) **excluye Perplexity** y
  todo lo que llega sin referrer. Hay que crear **channel group custom** con regex
  (`chatgpt|openai|perplexity|gemini|claude|copilot`) + UTM + campo oculto en
  formularios que viaje al CRM.
- **Logs de servidor**: hits por user-agent de bots de IA (el único dato duro de
  "me están leyendo").
- **Rank tracking de prompts**: correr un set fijo de 30–60 prompts en ChatGPT,
  Perplexity, Gemini y AI Overviews, cada mes, y registrar aparición + posición
  + fuente citada. Se puede hacer manual antes de pagar herramienta.
- Herramientas: Otterly (~$29/mes, entrada), Peec AI (€89–199, mejor relación),
  Profound ($399+, enterprise), addons de Semrush/Ahrefs (baratos pero flojos).


### 3.1 Nota crítica: robots.txt SÍ es palanca, `llms.txt` NO

Se confunden porque se instalan juntos. No son lo mismo:

- **robots.txt es un interruptor real.** Si estabas bloqueando (o el CDN bloqueaba
  por ti), desbloquear produce un salto genuino y rápido. La mayoría de sitios
  construidos o auditados antes de 2023 bloquean crawlers de IA **sin saberlo**,
  vía configuraciones agresivas de Cloudflare/Sucuri/CDN que tratan a
  OAI-SearchBot y PerplexityBot como scrapers maliciosos.
  Contexto: GPTBot pasó de 5% a 30% del tráfico de crawlers de IA entre may-2024
  y may-2025 (+305% de crecimiento). El que estaba bloqueado se perdió eso entero.
- **`llms.txt` es un archivo que hoy nadie lee en producción.** Ver tabla de humo.

**Por lo tanto**: cuando alguien dice "puse robots.txt + llms.txt y me llegaron
leads", el mecanismo causal casi siempre es **dejé de bloquear**, no **añadí un
archivo nuevo**. Es una distinción que cambia el diagnóstico: si el sitio del
cliente ya permite los bots, copiar ese script **no va a hacer absolutamente nada**
y hay que ir a los pilares 2, 3 y 4.

**Cómo comprobarlo en 15 minutos (antes de replicar):**
1. `curl -s https://dominio.com/robots.txt` y ver si hay `Disallow` para
   GPTBot / OAI-SearchBot / PerplexityBot / ClaudeBot / Google-Extended.
2. Wayback Machine del `/robots.txt` **antes** del cambio → si antes bloqueaba,
   caso cerrado, el mérito es de robots.txt.
3. Logs de servidor: hits por user-agent de bots de IA, antes vs después.
   Si el crawl subió al quitar el bloqueo y los leads vinieron después, hay causa.
4. Si el robots.txt de antes **ya permitía** los bots → el salto vino de otro lado
   (menciones en foros, un listicle, prensa, o simplemente el crecimiento general
   del uso de ChatGPT). Ojo con atribuir a lo que se tocó por último.

**Diferenciar los tres bots de OpenAI** (error común):
| Bot | Para qué | Si lo bloqueas |
|---|---|---|
| `OAI-SearchBot` | Búsqueda en ChatGPT | **Desapareces de ChatGPT Search** |
| `GPTBot` | Entrenamiento del modelo | Sigues en ChatGPT Search, pero pierdes familiaridad del modelo a largo plazo |
| `ChatGPT-User` | Fetch disparado por el usuario | El usuario no puede abrir tu página desde el chat |

---

## 4. Qué es humo (para no vender mentiras)

| Táctica | Veredicto |
|---|---|
| `llms.txt` | **Evidencia nula.** Google dijo explícitamente (may 2026) que no lo usa; Gary Illyes y Mueller lo compararon con meta keywords. SE Ranking probó con XGBoost: quitar la variable *mejoró* la predicción → es ruido. Adopción ~10%. Cuesta 20 min, se puede poner "por si acaso", pero **no se cobra ni se promete nada**. |
| FAQ schema para rich results | Google deprecó los rich results de FAQ (7 may 2026). El tipo `FAQPage` sigue válido para *comprensión* de página, pero ya no da snippet visible. No lo vendas como "vas a salir en Google con acordeón". |
| "Schema especial para IA" | No existe. Google dice explícitamente que no hay requisitos técnicos ni schema especial para AI Overviews. |
| Word count mágico | No existe. Lo que importa es densidad de respuesta por chunk. |
| Reescribir contenido con IA para "optimizar" | Contraproducente: produce tono de consenso, redundante → los motores lo ignoran. Lo citable es **dato propio y perspectiva original**. |

---

## 5. Datos para el pitch comercial (con fuente)

- AI Overviews aparecen en ~**48%** de las queries de Google.
- CTR orgánico cae **61%** cuando hay AI Overview (Seer, sep 2025: 1.76% → 0.61%).
- **60%** de las búsquedas terminan sin clic.
- Marcas **citadas** en AI Overviews ganan **35% más clics orgánicos** y 91% más de pago.
- Tráfico de IA convierte a **~4.4x** la tasa del orgánico tradicional.
- Reparto de referidos IA (abr 2026, Statcounter): ChatGPT **76.85%**, Gemini 9.0%,
  Perplexity 7.73%, Copilot 3.76%, Claude 2.66%.
  → **Prioridad 1 = ChatGPT.** Todo lo demás es secundario en volumen.
- Paper GEO (Aggarwal et al., KDD 2024, Princeton): las mejores tácticas suben
  **+41%** en visibilidad ajustada por posición. Citar estadísticas gana en
  "Law & Government" y preguntas de opinión; añadir citas textuales gana en
  "People & Society", explicación e historia.
- Estructura: +17.3% de citas por optimización estructural (U. Tokio / Tsukuba, mar 2026).

---

## 6. Vertical médico (Dra. Alejandra Paz, Dra. Alex Ponce, etc.)

Es **YMYL**: la vara es más alta y eso es una **ventaja competitiva**, porque casi
nadie lo cumple.
- El peso de E-E-A-T en queries YMYL triplica al de queries normales (~24% vs ~8%
  de correlación con ranking).
- Requisitos duros:
  - Autor **nombrado con credenciales reales** (no "equipo editorial").
  - Línea visible "**Revisado médicamente por [Nombre], [Cédula/Especialidad]**"
    + fecha de revisión.
  - Página de bio del médico: título, cédula profesional, certificaciones del
    consejo, afiliaciones hospitalarias, años de práctica.
  - Credenciales **también en schema** (`Person` + `knowsAbout` + `hasCredential`),
    no solo en texto.
  - Subtipo `MedicalBusiness` / `Physician` / `MedicalClinic`, y `MedicalWebPage`
    en contenido clínico.
- Local: Google Business Profile actualizado + reseñas + directorios (en MX:
  Doctoralia, Top Doctors) alimentan las respuestas locales de IA.
- El nicho médico es de los **menos saturados** en visibilidad de IA hoy → ventana
  de primer movedor real.

---

## 7. Español / México

- No sirve traducir contenido "español global". Hay que fijar mercado: `es-MX`
  con hreflang, moneda, ejemplos, instituciones y modismos locales coherentes.
- Ventaja estructural: el español mexicano es el dialecto de referencia en el
  corpus hispano de los LLMs → contenido bien hecho en es-MX pesa desproporcionadamente.
- Competencia GEO en español está muchísimo más verde que en inglés.

---

## 8. Pendientes de investigación (no cerrado)

- [ ] Video de YouTube que va a pasar Dante.
- [ ] Post de Instagram (bloqueado por el proxy de esta sesión — necesito el texto).
- [ ] Scripts que pasó el socio (los de TSC Labs) — auditarlos antes de copiarlos.
- [ ] URLs reales de los sitios (Dra. Alejandra Paz, Dra. Alex Ponce, consultora).
- [ ] Definir el set de prompts semilla por vertical para medición mensual.
- [ ] Probar en vivo: ¿aparecen hoy las doctoras en ChatGPT/Perplexity para
      prompts tipo "mejor ortodoncista en [ciudad]"? → línea base.

---

## Fuentes principales
- Aggarwal et al., *GEO: Generative Engine Optimization*, KDD 2024 (Princeton/IIT Delhi)
- Seer Interactive — estudios de CTR y citas (2025–Q1 2026)
- Onely — rendering gap de crawlers de IA (feb 2026)
- SE Ranking — estudio llms.txt sobre 300k dominios
- Statcounter — reparto de referidos IA (abr 2026)
- Averi.ai — correlación menciones vs backlinks
- Google Search Central — guía de AI features (may 2026)
- Cloudflare — política de bloqueo de crawlers (jul–sep 2026)
