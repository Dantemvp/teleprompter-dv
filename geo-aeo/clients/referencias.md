# Sitios de referencia y contexto

| Sitio | URL | Repo | Rol |
|---|---|---|---|
| Dentisania · Dra. Alejandra Paz | https://draalepaz.com/ | `Dantemvp/dentisania-web` | Cliente |
| Dra. Fedra Aldama | https://drafedraaldama.com/ | `Consultora-DV/drafedraaldama` | Cliente |
| Dante Vega (marca personal / consultora) | https://dantemvp.com/ | — | Propio |
| **TSC Labs** | https://tsc-labs.com.mx/ | — | **Referencia GEO del socio** |

## TSC Labs — por qué importa
Es el caso que originó el proyecto: el socio reporta leads orgánicos de agentes
de IA tras tocar `robots.txt` y añadir `llms.txt`. Es nuestro **caso de control**.

Lo que hay que extraer de ahí (Codex, que sí tiene red):
- [ ] `robots.txt` actual, y su histórico en Wayback Machine (¿bloqueaba antes?)
- [ ] `llms.txt` actual y fecha de aparición
- [ ] Si el HTML es server-rendered o depende de JS
- [ ] Schema JSON-LD que emite
- [ ] Menciones de terceros aparecidas en la ventana del "salto" de leads
- [ ] Estructura de contenido: ¿answer-first? ¿headings como preguntas?

**Hipótesis a falsear**: que el salto vino del `llms.txt`. La explicación
alternativa (más probable) es que dejó de bloquear crawlers, o que el sitio ya
era HTML limpio y lo que cambió fue otra cosa. Ver `tools/verify-causal`.
