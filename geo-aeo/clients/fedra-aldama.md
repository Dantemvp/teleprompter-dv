# Cliente: Dra. Fedra Aldama

- **Slug interno**: `fedra-ald-t84qz` (coincide con teleprompter)
- **Vertical**: medicina estética / manejo de peso con apoyo farmacológico (GLP-1)
- **Mercado**: Los Mochis, Sinaloa, MX + envíos a toda la república
- **Idioma**: es-MX
- **Última verificación**: 2026-09-03 (vía búsqueda web; NO verificado en fuente directa)

## NAP y credenciales (extraído de sus propios perfiles públicos)
> Ojo: esto viene de bios de TikTok/IG. **Confirmar con ella antes de publicarlo en schema.**

- Nombre: Dra. Fedra Aldama
- Título: Médico Cirujano — Universidad Autónoma de Guadalajara (UAG)
- **Cédula profesional: 11015233**
- Posgrado: Máster en Medicina Estética y Antienvejecimiento — IMMAE
- Especialidad declarada: pérdida de peso con apoyo farmacológico y hábitos saludables
- Dirección: Blvd. Río Fuerte #2677, Col. Viñedos, C.P. 81228, Los Mochis, Sinaloa
- Teléfono: +52 668 146 3502
- **Aviso de publicidad COFEPRIS: 2425012002A00026**

## Presencia digital encontrada
| Canal | URL | Estado |
|---|---|---|
| Instagram | `instagram.com/dra_fedraaldama` | Activo, ~7.2k seguidores |
| TikTok | `tiktok.com/@dra.fedra.aldama` | Activo, contenido educativo (GLP-1, proteína) |
| Facebook | `facebook.com/p/Dra-Fedra-Aldama-61550542274925` | Activo |
| **Sitio web** | — | **NO ENCONTRADO** |
| Google Business Profile | — | Sin verificar (no puedo abrir Maps) |
| Doctoralia / Top Doctors | — | Sin verificar |

## Diagnóstico preliminar
**Su entidad vive 100% en plataformas sociales.** No aparece sitio web propio en
búsqueda. Eso significa que hoy:
- No hay superficie que los crawlers de IA puedan leer, chunkear y citar.
- IG y TikTok son malos vectores de cita para recomendaciones locales: cerrados,
  sin HTML indexable útil, y su contenido no se extrae como pasaje.
- Toda su prueba de autoridad (cédula, COFEPRIS, IMMAE) está enterrada en bios
  de redes en vez de estar en HTML + schema, que es exactamente lo que YMYL premia.

**Esto NO es un proyecto de auditoría, es un proyecto de construcción.** El
entregable no es "arreglar la página", es "crear el activo citable". Es un deal
más grande y con mejor techo, y sin competencia local: casi ningún médico estético
en Sinaloa tiene su cédula y su aviso COFEPRIS en `Person` schema.

## Activo diferencial que ya tiene y casi nadie publica bien
Cédula profesional + aviso COFEPRIS + universidad + posgrado nombrados y verificables.
Eso es munición E-E-A-T de primer nivel para un vertical YMYL. Va en:
- `Person` + `hasCredential` + `knowsAbout` + `alumniOf`
- Bloque visible "Revisado médicamente por / Cédula / COFEPRIS" con fecha
- Página de bio profunda como *entity home*

## Pendientes
- [ ] Confirmar si tiene sitio web (aunque sea uno viejo o un link-in-bio).
- [ ] Verificar Google Business Profile: ¿existe, está reclamado, tiene reseñas?
- [ ] Verificar presencia en Doctoralia / Top Doctors / directorios de Sinaloa.
- [ ] Validar con ella los datos de arriba antes de publicarlos.
- [ ] Definir set de prompts locales: "médico para bajar de peso en Los Mochis",
      "quién receta [GLP-1] en Los Mochis", "medicina estética Los Mochis", etc.
