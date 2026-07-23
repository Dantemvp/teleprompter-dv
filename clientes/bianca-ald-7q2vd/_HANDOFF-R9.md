# Handoff · Bianca Aldama · R9 (Novena grabación)

> Última actualización: 2026-07-23 · Para continuar desde Claude Code móvil.

## Dónde vamos
Acabamos de **cerrar R8 (El Fuerte)** y **abrir R9**. R9 está creada en `index.json` como contenedor vacío (`"guiones": []`), lista para planear. Dante va a ir compartiendo reels de referencia uno por uno.

## Mecánica de R9 (lo que hago con cada reel que mande Dante)
1. **Identifico la categoría** del reel:
   - **Guion** → script completo. Dante me pasa la transcripción él mismo (no depender de gettranscribe).
   - **Transición interior** (`trans-int`) → se graba dentro de tienda.
   - **Transición exterior** (`trans-ext`) → se graba en exteriores.
   - **Tienda** (`tienda`) → skit 2 voces / reseña QR.
2. **Si es transición** → la registro en `index.json` con su link + nota de la mecánica visual. No lleva guion largo.
3. **Si es guion** → aplico formato (al-grano o guionado), voz Bianca, retención estilo Converzo, reglas anti-IA. Dante aprueba ANTES de subir el `.md`.

## Numeración (próximos slugs disponibles)
- **Guion:** `g-22` (último usado g-21)
- **Transición interior:** `ri-13` (último ri-12)
- **Transición exterior:** `re-06` (último re-05)

## Reglas clave que NO se olvidan
- **Formato "al grano"**: spec en `~/.claude/skills/cliente-bianca/formato-al-grano.md`. Lista rápida 15–30s, 1 ítem por plano, verbos dinámicos variados, **reordenar** colores/ítems (nunca calcar la referencia), CTA sutil al centro o cierre de serie.
- **Voz Bianca**: Amante/Explorador · "Confianza Radical" (se lleva en tu cuerpo real) · "Estilos nuevos siempre".
- **Compliance**: sin "barato"/"liquidación" (usar accesible / nueva colección / edición limitada). Máx 5 hashtags.
- **Anti-IA Dante**: sin "no es X, es Y", sin "real" de relleno, sin muletillas. Listo para grabar.
- **El hook de raíz NO se cambia** si a Dante le gusta; solo se proponen variantes en notas `✱`.

## Series abiertas (candidatas a parte 2 en R9)
- **g-19** → parte 2 = colores para **pieles claras** (mismo molde, otros colores; lead magnet "morena/clara").
- **g-18** → parte 2 = más combos del tercer color (cobalto+rojo, azul marino+amarillo, rojo+lavanda, burdeos+rosa).
- **g-20** → parte 2 = más vestido+complemento.

## Estado gettranscribe (herramienta motor)
- Se **reparó el config**: `.claude.json` apuntaba al endpoint HTTP roto (`api.gettranscribe.ai/mcp` rechaza `initialize`). Se revirtió a **stdio** con la API key en env → funciona.
- ⚠️ Requiere **reiniciar Claude Code** para que el MCP cargue. Mientras, la **API REST directa** sirve de respaldo.
- API key: en `.claude.json` (env `GETTRANSCRIBE_API_KEY`). Endpoint REST de respaldo: `POST https://api.gettranscribe.ai/transcriptions` con header `x-api-key`.

## Flujo de guardado en el repo (recordatorio para móvil)
- Guiones = archivos `.md` en `clientes/bianca-ald-7q2vd/` + entrada en `index.json`.
- Antes de push: `git fetch && git rebase origin/main` (el editor web diverge seguido; **nunca** hard reset).

---
**Siguiente acción**: esperar el primer reel de referencia de R9 de parte de Dante.
