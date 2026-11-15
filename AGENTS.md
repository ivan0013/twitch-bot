# Instrucciones para agentes — Twitch Queue

Aplicación `twitch-bot` creada con la plantilla `ivan0013/ideas/templates/mvp` (Next.js + Vercel + Neon opcional).

## Diseño obligatorio: Impeccable

- **Antes de crear una interfaz de producto**, comprobar que la [skill oficial Impeccable](https://github.com/pbakaus/impeccable) está instalada en este proyecto: Codex en `.agents/skills/impeccable/SKILL.md`; GitHub Copilot en `.github/skills/impeccable/SKILL.md`. El generador intenta instalarla automáticamente (sin hooks para no bloquear la ejecución desatendida). Si faltan archivos, ejecutar `npm run design:install` y documentar el pendiente si no es posible. No es suficiente mencionar Impeccable en un prompt.
- Ejecutar `/impeccable init` (en Codex: `$impeccable` con el subcomando `init`) para describir la audiencia, tareas y restricciones reales del producto en `PRODUCT.md`. No inventar métricas, reseñas ni características. Documentar la dirección visual en `DESIGN.md` una vez definida.
- Usar activamente la skill en los cambios de UI: `shape` o la acción de diseño en pantallas nuevas; `critique`, `audit` y `polish` antes del lanzamiento. Ejecutar `npm run design:check` y corregir o justificar sus hallazgos.
- **No publicar el placeholder de la plantilla como diseño final.** `src/app/page.tsx` y `globals.css` son solo un arranque técnico. Evitar el estilo SaaS genérico por inercia (gradientes púrpura/azul, tipografía por defecto, tarjetas en tarjetas, tiles de iconos, copy vacío y testimonios falsos). Se pueden usar patrones familiares cuando son la mejor elección para el usuario.
- Priorizar la tarea principal del MVP sobre marketing decorativo. Diseñar para móvil y escritorio, teclado, foco visible, contraste, jerarquía, y estados carga/vacío/error/éxito. Revisar el resultado **renderizado**; una revisión estática no sustituye verlo.
- Los hooks no se activan automáticamente durante el scaffolding. Para instalarlos/habilitarlos: `npm run design:install`, luego `/impeccable hooks on` y aprobarlos en la herramienta (Codex: `/hooks`). No afirmar que funcionan sin confirmarlo.

## Observabilidad de este MVP: PostHog por defecto

- Este proyecto **ya incluye** PostHog Error Tracking. No reinstalar ni sustituir `posthog-js`, `posthog-node`, `src/instrumentation-client.ts` o `src/instrumentation.ts` sin una causa técnica.
- Usar el **proyecto compartido PostHog** de la fábrica de MVPs, no crear otro proyecto sin autorización. Los errores deben incluir `mvp_slug=twitch-bot`; si se añaden eventos personalizados, etiquetarlos también.
- Configurar en Vercel, **antes del despliegue que vayan a utilizar usuarios**, `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (project token público) y `NEXT_PUBLIC_POSTHOG_HOST` (host regional correcto: comprobarlo en PostHog). Configurarlos también en `.env.local` solo si se necesita probar un build local.
- Si faltan las variables la app sigue funcionando, pero **no se considera observabilidad activa**. El agente debe mencionar el pendiente, no declarar que PostHog está operativo ni registrar un token de ejemplo como real.
- Next.js incrusta las variables `NEXT_PUBLIC_*` en el bundle al compilar: reconstruir y desplegar al cambiarlas.
- Mantener por defecto **solo captura de errores**. No activar replay, pageviews, autocapture, cookies persistentes o perfiles identificados sin petición explícita y revisión de privacidad aplicable.
- Nunca registrar secretos, tokens, cuerpos de peticiones, PII u otros datos sensibles. Sanear errores personalizados antes de enviarlos. Para código ejecutado en Edge o errores fuera de las peticiones cubiertas por los hooks, revisar adicionalmente los logs de Vercel.

## Checklist de lanzamiento

- [ ] Impeccable instalado en este repositorio y `PRODUCT.md` basado en datos reales; diseño propio definido o limitación de instalación documentada.
- [ ] Se realizaron `critique`, `audit`, `polish`, `npm run design:check` y revisión renderizada en móvil y escritorio; los fallos no resueltos están explicitados.
- [ ] No quedan placeholders de la plantilla, claims ficticios o métricas inventadas presentadas como reales.

- [ ] El código de los dos hooks de instrumentación sigue presente.
- [ ] Ambas variables PostHog están configuradas con valores del mismo proyecto y región en el despliegue Vercel.
- [ ] Build y tests correctos; el despliegue se reconstruyó tras configurar variables.
- [ ] Se comprobó un error de prueba **no sensible** en un entorno controlado y se localizó con `mvp_slug=twitch-bot` en PostHog; eliminar cualquier código de prueba antes de publicar.
- [ ] Se documentan las limitaciones de runtime o consentimiento, si afectan a este MVP.

Para investigar incidencias desde ChatGPT, consultar PostHog filtrando por `mvp_slug=twitch-bot` y correlacionar con los logs/deployments de Vercel y el código de GitHub.
