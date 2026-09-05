# Planes de membresía dental — benchmark y diagnóstico

- **Fecha**: 2026-09-03
- **Motivo**: los planes publicados en `draalepaz.com/precios` venían de una
  referencia de mercado y no estaban autorizados por la clínica.
- **Decisión tomada**: **ocultados** del sitio (`MOSTRAR_PLANES = false` en
  `src/data/market.ts`). No borrados: se reactivan con una línea.

---

## 1. Los planes que estaban publicados

| Plan | $/mes | $/año | Incluía |
|---|---|---|---|
| Sonrisa Niños | $349 | $4,188 | 2 limpiezas, revisiones, flúor, 1 radiografía, 10% desc. |
| Sonrisa Adulto | $549 | $6,588 | 2 limpiezas, revisión en cada una, radiografías, 1 urgencia, 10% desc. |
| Familiar | $899 | $10,788 | Lo del Adulto por integrante, prioridad de cita, 15% desc. |

## 2. El problema real: no están baratos, están mal calibrados

La intuición de Dante era "se me hacen muy baratos". El número dice lo contrario.
Valuando lo incluido **a los propios precios de lista de la clínica**
(limpieza $700), el paciente paga esto por cada peso de servicio recibido:

| Plan | Costo anual | Valor incluido (estimado generoso) | Ratio |
|---|---|---|---|
| Niños | $4,188 | ~$1,800 | **2.3x** |
| Adulto | $6,588 | ~$2,600 | **2.5x** |
| Familiar | $10,788 | ~$2,600 (1 integrante) | **4.1x** |

**Benchmark EE.UU.**: las membresías in-house se mueven en **$300–450 USD/año**
para adulto, cubriendo 2 limpiezas + 2 exámenes + radiografías, más 15–20% de
descuento en lo demás. Como allá una limpieza cuesta $100–200 USD, el ratio
precio/valor queda en **~1.0–1.5x**. La membresía se paga sola con lo incluido;
el margen sale del descuento y de la mayor aceptación de tratamiento.

**Aquí el ratio está entre 2.3x y 4.1x.** Un paciente que saque la cuenta
concluye —con razón— que le conviene pagar cada servicio por separado.

## 3. Por qué esto importa para GEO, no solo para ventas

Un plan con esa relación precio/valor no produce ingresos recurrentes: produce
**reclamaciones y reseñas negativas**. Y las reseñas son uno de los insumos que
los motores generativos usan para responder consultas locales de salud. Publicar
un mal deal es sembrar exactamente la señal off-site que estamos tratando de
construir a favor.

Además eran precios **no autorizados** en el sitio de un consultorio médico.
Eso no se corrige con copy.

## 4. Si lo quieren relanzar, cómo calibrarlo

Regla del benchmark: **el precio anual debe rondar 1.0–1.5x el valor de lo
incluido a precio de lista propio.**

Con limpieza a $700, un Plan Adulto honesto se vería más o menos así:
- 2 limpiezas ($1,400) + 2 revisiones + radiografías de control ≈ **$2,000–2,600**
  de valor.
- Precio sugerido: **$2,400–3,600 al año** (~$200–300/mes), no $6,588.
- Descuento en tratamientos: **15–20%**, no 10%. Es el estándar y es donde de
  verdad se gana, porque sube la aceptación de tratamiento.
- Pago anual con 5–8% de descuento sobre el mensual, para mejorar el flujo.

**El margen de una membresía no está en la cuota**: lo preventivo se cotiza
cerca del punto de equilibrio y la ganancia viene del descuento que ancla al
paciente a la clínica. Cobrar 2.5x la cuota rompe justo el mecanismo que hace
que el modelo funcione.

## 5. La oportunidad que sí hay aquí (para después)

"Dentista sin seguro en Guadalajara / Zapopan" es una consulta con intención
altísima y sin nadie cubriéndola bien en la zona. Una página de membresía bien
armada —con tabla comparativa, precios claros y qué incluye— es de los formatos
más citados que existen. Pero se lanza **con precios autorizados y calibrados**,
no antes.

## 6. Fuentes
- BoomCloud — ejemplos de pricing de membresías dentales in-house (2026)
- mConsent — "How much should you charge for a dental membership plan" (2026)
- DentalPlans.com / DentalSave / Careington / Aspen — precios públicos vigentes 2026
- Shared Practices — guía de implementación de membresías dentales

*Nota: los benchmarks son del mercado estadounidense. No encontré un benchmark
publicado de membresías dentales in-house para México; el ajuste se hizo con
los precios de lista de la propia clínica, que es la referencia correcta.*
