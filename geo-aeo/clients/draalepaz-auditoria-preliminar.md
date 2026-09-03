# Auditoría preliminar — draalepaz.com (Dentisania)

- **Fuente**: código de `Dantemvp/dentisania-web` @ `2a33e6b` (clonado 2026-09-03)
- **Alcance**: revisión de código fuente. **NO** incluye verificación en producción
  (no puedo hacer fetch de URLs en esta sesión).
- **Stack**: Astro 7 (SSG) + MDX + Tailwind 4 + sitemap oficial.

## Veredicto general
El sitio está **muy por encima** del promedio del vertical dental en México.
No es un proyecto de rescate; es uno de afinación. Los pilares 1 y 2 están
esencialmente resueltos. El trabajo real está en pilar 3 (entidad *persona*)
y pilar 4 (off-site).

## Pilar 1 — Acceso: ✅ SANO
- Astro SSG → **HTML estático server-rendered**. Los crawlers de IA que no
  ejecutan JS ven el contenido completo. Esto elimina de golpe el riesgo #1
  de todo el proyecto.
- `robots.txt`: `User-agent: * / Allow: /` + sitemap declarado. Ningún bot de
  IA bloqueado. Correcto.
- `sitemap-index.xml` generado por `@astrojs/sitemap` con `i18n: es-MX`.
- Canonical absoluto y `hreflang` es-MX + x-default correctos.
- **Pendiente de verificar en producción**: si el hosting (Cloudflare/Vercel)
  bloquea bots de IA en el edge. El robots.txt del repo no puede probarlo.

## Pilar 2 — Extractabilidad: ✅ BIEN
- 11 rutas + blog con 10+ artículos en MDX con títulos de intención real
  ("cuánto cuesta ortodoncia guadalajara", "dolor de muela qué hacer",
  "alineadores no sirven para todos"). Esos títulos SON preguntas de fan-out.
- `MedicalWebPage` + `MedicalProcedure` + `FAQPage` + `BreadcrumbList` presentes.
- **Pendiente de revisar a detalle**: si cada sección de cada artículo cumple
  answer-first de 40–80 palabras. Es el trabajo fino que sigue.

## Pilar 3 — Entidad: ⚠️ EL HUECO PRINCIPAL
Lo que está bien:
- `Dentist` con `@id`, NAP completo, geo del pin GBP, horarios, `areaServed`,
  `hasMap`, `sameAs` filtrado (no publica placeholders `TODO_DANTE`).
- `['Person','Physician']` con `@id`, `hasCredential` (cédula SEP 4371905),
  `alumniOf`, `knowsAbout`, `memberOf`, `worksFor` enlazado al negocio.
- `AggregateRating` correctamente **condicionado** a que existan datos reales.
  Bien hecho: no inventa reseñas.

Los huecos, en orden de impacto:

1. **`Person` no tiene `sameAs`.** El `sameAs` vive solo en el nodo del negocio.
   Cuando un motor resuelve "¿quién es la mejor ortodoncista en Zapopan?" está
   desambiguando una **persona**, no un negocio. Sin `sameAs` en el `Person`,
   la Dra. Paz y su Instagram/TikTok/Doctoralia son entidades sueltas que el
   modelo no consolida. **Fix de 10 minutos, impacto alto.**
2. **`hasCredential` sin `url` de verificación.** La cédula SEP es verificable
   públicamente en `cedulaprofesional.sep.gob.mx`. Añadir esa URL convierte una
   afirmación en una credencial comprobable — exactamente lo que YMYL premia.
3. **El Dr. Carlos Nuño Castro no tiene nodo `Person` propio.** Está en el
   config (cirujano maxilofacial, 2 cédulas SEP, perfil de Doctoralia) pero no
   se emite como entidad. Es autoridad E-E-A-T tirada a la basura, y además
   abre un cluster de contenido entero (cirugía ortognática, implantes, trauma
   facial) que hoy nadie está cubriendo.
4. **`reviews.ratingValue` / `reviewCount` vacíos.** Correcto no inventarlos,
   pero es tarea real: llenarlos con los datos verdaderos del GBP.
5. `cedulaLicenciatura` y `email` siguen como `TODO_DANTE`.

## Pilar 4 — Off-site: ❌ SIN TRABAJAR (mayor oportunidad)
- **Perfil de Doctoralia existe pero está sin reclamar.** Ya está anotado en el
  config como tarea. Es la acción individual de mayor retorno: Doctoralia es
  fuente citada para consultas médicas locales en MX.
- Sin presencia detectada en listicles "mejores ortodoncistas en Guadalajara /
  Zapopan", que es el formato que más citas produce.
- `googleReview` (link directo para dejar reseña) ya está en el config — hay
  infraestructura para pedir reseñas, falta el proceso.
- **Nota**: en mi búsqueda web no aparece "Dentisania" por ningún lado. Mi
  herramienta está limitada a resultados de EE.UU., así que no es concluyente,
  pero es consistente con un sitio recién lanzado y sin señales off-site.

## Higiene menor
- `README.md` sigue siendo el template por defecto de Astro ("Astro Starter Kit:
  Minimal"). Cosmético, pero es de las cosas que un auditor externo usa para
  juzgar el cuidado del proyecto.
- `InstagramEmbed.astro` carga JS de terceros → ese contenido es invisible para
  crawlers de IA. Irrelevante si es decorativo; problema si ahí vive contenido
  con valor de cita.

## Siguiente paso propuesto
Los fixes 1–3 del pilar 3 son código, están acotados y se hacen en una sesión.
El pilar 4 es trabajo humano y de calendario, y es donde está el 80% del techo.

---
# Segunda pasada — capa de contenido (2026-09-03)

La primera pasada solo cubrió configuración, schema, robots y estructura de
archivos. Esta revisa el contenido y encuentra cuatro cosas más.

## 5. `isPartOf` apunta a un nodo que no existe — BUG
`articleSchema()` emite `isPartOf: { '@id': '<url>/#website' }`, pero **no existe
ningún nodo `WebSite`** en todo `src/lib/schema.ts`. Es una referencia colgante:
el grafo apunta a una entidad que nunca se declara.
- **Impacto**: rompe la integridad del `@graph`. Los parsers estrictos lo marcan
  como referencia no resuelta y se pierde la relación artículo → sitio.
- **Fix**: añadir `websiteSchema()` con `@type: 'WebSite'`, `@id: <url>/#website`,
  `name`, `url`, `inLanguage: es-MX` y `publisher: {'@id': ORG_ID}`, e incluirlo
  en el `graph()` de todas las páginas.

## 6. Cero frescura: 0 de 12 artículos tienen `updatedDate`
El template hace `dateModified: (d.updatedDate ?? d.pubDate)`. Como ningún post
define `updatedDate`, **`dateModified` siempre es igual a `datePublished`**.
- **Impacto**: para los motores, todo el blog está congelado en su fecha de
  publicación. Perplexity favorece contenido de <30 días (~3.2x más citas) y la
  frescura pesa en todas las superficies.
- **Fix**: proceso de revisión trimestral que toque `updatedDate` cuando el
  contenido cambie de verdad. **No falsear la fecha sin cambiar el contenido** —
  eso es manipulación y se detecta.

## 7. El artículo de precios no da un precio — EL HALLAZGO IMPORTANTE
`cuanto-cuesta-ortodoncia-guadalajara.mdx` está bien escrito, con voz propia de
la doctora, answer-first y buena estructura. Pero **nunca da una cifra ni un
rango**: "No te voy a tirar una cifra al aire, porque sin ver tu boca sería
inventada".

Comercialmente se entiende. Para GEO es fatal:
- La query es literalmente "cuánto cuesta la ortodoncia en Guadalajara".
- Cuando un motor sintetiza esa respuesta, **cita a quien da un número**. Una
  página que se niega a responder la pregunta de su propio título no entra en
  la respuesta, por bien escrita que esté.
- Es el ejemplo perfecto de la diferencia entre buen copy y contenido citable.

**Fix propuesto** (sin comprometer a la clínica): dar un rango con contexto
explícito de qué lo mueve. Algo como "en Guadalajara y Zapopan un tratamiento
de ortodoncia suele ubicarse entre $X y $Y según complejidad y técnica; lo que
define tu número es…". Se conserva la honestidad, se gana la cita, y la tabla
comparativa por técnica es de los formatos más citados que existen.

Este patrón hay que revisarlo en **todos** los artículos: ¿la página responde
de verdad la pregunta de su título, o la esquiva hacia la valoración?

## 8. `reviewedBy` es la misma persona que `author`
Ambos apuntan a `DOCTOR_ID`. No es un error —ella es la especialista— pero un
revisor distinto (p. ej. el Dr. Nuño para contenido quirúrgico) es señal YMYL
más fuerte que auto-revisarse. Menor, pero suma.

## Lo que TODAVÍA no he revisado
- `src/data/services.ts` (37 KB) y `market.ts` — el grueso del contenido de servicios.
- Las 11 páginas estáticas una por una (answer-first sección por sección).
- Los otros 11 artículos del blog con el criterio del punto 7.
- Comportamiento en producción: edge, headers, tiempos de respuesta, indexación real.
