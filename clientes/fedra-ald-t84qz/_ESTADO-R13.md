# Estado de R13 · dónde va todo y cómo seguir

> Este archivo NO está en el índice: no lo ve la doctora. Es el traspaso entre sesiones.
> Última actualización: 12-sep-2026

---

## ⏭️ LO SIGUIENTE: barrido de verificación de TODOS los guiones

Acordado con Dante el 12-sep. Se revisa **guion por guion, línea por línea**, cada
afirmación que se haga en cámara: confirmarla, refutarla, matizarla o mejorarla,
con fuente de los últimos cinco años y liga que abra.

**Regla dura: no se modifica ninguna línea hablada. Todo entra como ficha
`// DATO:` desplegable.** La línea ya fue aprobada por él; cambiarla por debajo
es lo que rompe la confianza. La ficha le deja decidir con el argumento enfrente.

Empezar por los que más afirman: r13-11 (carbohidratos), r13-08 (menopausia),
r13-12 (GLP-1), r13-05 (abdomen), r13-10 (dosis). Los de opinión pura
(r13-04, r13-13, r13-15) casi no llevan ficha.

---

## Qué cambió en el método y por qué (leer antes de escribir nada)

En R12 se perdió tiempo de grabación porque los guiones traían palabras ajenas a ella. Tres arreglos salieron de ahí y **los tres son obligatorios ahora**:

**1. La regla 70/30** — `planeador-grabaciones/protocolo-referencias.md` §3.
Se conserva el **70% de la referencia, fraseo incluido**. Solo se cambia por cuatro razones: compliance, nicho, voz o dato falso. Cada línea cambiada se justifica. Antes decía lo contrario ("mínimo 30% de material propio") y por eso yo reescribía todo.

**2. Escribir desde su habla real** — `fedra-contexto/references/habla-real.md`.
Corpus verbatim: 15 reels suyos transcritos, 6 notas de voz, sus captions, y un banco de sustituciones. ⚠️ **Tiene dos registros y no se mezclan**: lo que le manda a Dante en confianza (groserías, norteño cerrado) NO va a guion. Lo que sí transfiere es cómo piensa: listas sin conectores, proponer en vez de ordenar, diminutivos suaves.

**3. Verificar cada dato** — `protocolo-referencias.md` §5.
Literatura de los últimos 5 años, abrir el paper y confirmar el número adentro, y liga que abra (PubMed/PMC cuando la editorial bloquea). Lo que se verifica se documenta en una ficha `// DATO:` desplegable dentro del guion.

---

## Sintaxis del teleprompter

```
# Título
## Escena 01            (o "## Plano 01" en videos mudos)
DRA: lo que dice, con (direcciones entre paréntesis) dentro de la misma línea
// PANTALLA — texto estampado
// DATO: <título> || ANTES: <lo que se decía> || AHORA: <lo verificado> || FUENTE: <pub> || LINK: <url>
```

- El guion **no lleva encabezado** ni notas de producción. Solo título, escenas y diálogo.
- `// DATO:` se pinta como desplegable cerrado. Va al dato verificable, nunca al chiste ni a la opinión.
- En videos mudos las tarjetas y direcciones cuelgan de la escena sin línea hablada, y sí se pintan.
- `marca: "Xeomeen"` en el index.json pinta el badge azul de colaboración pagada.

---

## Cómo se arman los bloques

Máximo **4 videos por bloque**. Si ya hay cuatro, se abre uno nuevo. Nada de
bloques de un solo video, salvo lo que se graba fuera de la sesión.

## R13 · 16 guiones

**Bloque 1 · con modelo** — r13-01 el mapa de la toxina · r13-02 el chusco mudo · **r13-03 [XEOMEEN]** las tres cosas · r13-04 aquí no hay atajos

**Bloque 2** — r13-05 no vas a tener su abdomen · r13-08 GLP-1 en menopausia · r13-09 es muy fácil, dinero · r13-10 por qué van subiendo la dosis

**Bloque 3** — r13-11 carbohidratos · r13-12 lo mejor de los GLP-1 · r13-13 Los Cabos · r13-14 náuseas (b-roll)

**Bloque 4 · cierra de noche** — r13-15 consultorio en regla · r13-17 sin satanizar alimentos · r13-07 tu versión de vieja (nocturno, sin subtítulos)

**Fuera de sesión** — r13-16 outfits de congreso, se graba en Mérida el 26-27 sep

**UGC Xeomeen** — r13-ugc-xeomeen-quincena [XEOMEEN], sketch en borrador

---

## Producción, lo que no puede faltar

- **r13-01** sin frasco ni marca. Las 14 zonas del mapa son fuera de indicación; ella sí las puede hacer, el fabricante no las puede promover. Los de Xeomeen son r13-03 y el sketch, y solo tocan frente, entrecejo y patas de gallo.
- **r13-02** mudo, silueta negra recortada en edición, consentimiento firmado de quien preste el cuerpo.
- **r13-07** **VA SIN SUBTÍTULOS**, es decisión de formato. Avisarle a la editora antes. Tarjeta fija en el tercio superior y micrófono de mesa visible.
- **r13-16** cero nombres de medicamento, ni en voz ni en cuadro ni en gafete. Su cuenta ya trae castigo del año pasado por esto.

---

## Pendientes abiertos

1. **r13-11 carbohidratos: hablar con ella antes de grabar.** Su nota de voz traía la química cruzada y el guion ya la corrige, pero tiene que saberlo para no contradecirse en cámara.
2. **La paciente que bajó 20 kg y se embarazó**: sigue en espera hasta que nazca el bebé y haya consentimiento por escrito. r13-17 toma solo la idea, sin su mensaje ni fotos, así que ese sí se graba ya.
3. **Programa de niveles**: eliminado de R13. Ella tiró la idea para que el equipo la desarrolle; es tema de otra conversación. ⚠️ Cuando se retome: premiar con descuentos según cuánto medicamento compró un paciente es terreno delicado.
4. **NCTF y mesoterapia**: ella menciona guiones viejos que quedaron sin grabar. Hay que buscarlos.
5. **Testimonio de clínica ajena** (IG DJYERLFOu21): transcrito, sin guion. Es formato de anuncio de otra clínica.

---

## Herramientas

```bash
# transcribir sus reels y refrescar el corpus de voz
python3 ~/.claude/skills/fedra-contexto/scripts/transcribir-reels.py --top 15

# después de grabar: qué cambió ella en vivo contra el guion
python3 ~/.claude/skills/fedra-contexto/scripts/transcribir-reels.py --url <reel publicado> --guion clientes/fedra-ald-t84qz/<slug>.md

# notas de voz locales (whisper está instalado)
whisper <audio> --model small --language Spanish --output_format txt
```

Transcripciones guardadas en `fedra-contexto/data/transcripciones/` y `data/notas-de-voz/`.
Referencias de R13 transcritas en el scratchpad de la sesión; si se pierden, se vuelven a bajar con GetTranscribe (llave en `~/.claude.json`).
