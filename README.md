# QueueCtrl — Twitch bot

MVP generado a partir de [ivan0013/ideas](https://github.com/ivan0013/ideas/tree/main/templates/mvp). Panel web administrable y bot de Twitch con cola persistida en Neon.

## Funcionalidades

- Viewers: `!join` / `!apuntarme` (entrar), `!salir` / `!leave` (salir), `!cola` (estado y siguiente).
- Streamer (identificado mediante su Twitch user ID): `!abrircola`, `!cerrarcola`, `!siguiente`.
- Panel web: lista actualizada cada 5 s; abrir/cerrar; siguiente; vaciar.
- Una inscripción activa por usuario de Twitch. La cola se ordena por fecha de entrada, con desempate determinista. El siguiente se elimina al pasar su turno.
- Los viewers no necesitan registrarse en la web.

## Instalación

Requiere Node.js 22+, un proyecto Neon y una app Twitch registrada.

1. `npm install`
2. Copia `.env.example` a `.env.local` y configura las variables sin subir secretos.
3. Crea las tablas con `npm run db:generate && npm run db:migrate` (puedes usar `DATABASE_URL=...` en el entorno CLI).
4. `npm run dev` para el panel. Para webhooks de Twitch necesitas una URL pública HTTPS: despliega en Vercel o usa un túnel.
5. Vercel: asigna `DATABASE_URL`, `ADMIN_PASSWORD`, credenciales Twitch y variables PostHog del proyecto compartido; ejecuta migraciones antes de usar.
6. Instala Impeccable con `npm run design:install` y haz la revisión visual de la interfaz. No se incluye la skill remota en el repositorio inicialmente.

### Configuración de Twitch

- Registra una aplicación en [Twitch Developer Console](https://dev.twitch.tv/console/apps) y anota `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET` (el secreto no es necesario para la recepción de webhooks en ejecución, pero sí para aprovisionar y renovar tokens).
- Crea una cuenta de bot o usa una cuenta autorizada; consigue un **user access token** OAuth de esa cuenta con `user:write:chat`; el token debe corresponder a `TWITCH_BOT_USER_ID`. Para recibir `channel.chat.message`, el broadcaster o bot debe autorizar los permisos apropiados según la documentación EventSub de Twitch (`user:read:chat` y requisitos de autorización del suscriptor; si son cuentas distintas pueden requerirse permisos adicionales). No usar un app token en `TWITCH_BOT_ACCESS_TOKEN`.
- Crea una suscripción EventSub `channel.chat.message` de tipo `webhook` con `broadcaster_user_id` y `user_id` del bot, callback `https://TU_DOMINIO/api/twitch/eventsub` y un secreto aleatorio de 10 a 100 caracteres idéntico a `TWITCH_EVENTSUB_SECRET`. Usa para crear la suscripción un token de acceso de aplicación cuando Twitch lo requiera y verifica su documentación actual.
- Twitch envía una solicitud de challenge: el endpoint responde el challenge tras validar HMAC SHA-256. La API verifica timestamp, firma e ID, y deduplica eventos en Neon.
- Para enviar mensajes, el bot llama a `POST /helix/chat/messages` con el user token de escritura. **La renovación del token OAuth no está automatizada en este MVP**; cuando expire, se debe actualizar. No se emiten mensajes si faltan credenciales.
- Verifica suscripciones activas y scopes en la [documentación EventSub](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage).

## API

- `GET /api/queue`: estado público (alias y fecha de entrada; no expone IDs de Twitch).
- `POST /api/queue`: requiere HTTP Basic `admin:ADMIN_PASSWORD`, acción JSON `open | close | next | clear`. Solo por HTTPS. El panel no persiste la contraseña.
- `POST /api/twitch/eventsub`: webhook firmado, no lo llames directamente con mensajes de chat sin HMAC.
- `GET /api/health`: comprobación de vida (no de disponibilidad de Neon).

## Limitaciones y seguridad

- MVP de un solo canal y una sola cola. Siguientes pasos: varios canales, overlays de OBS, preferencias, expulsar usuario, roles/moderadores y aviso automático de turnos al ejecutar la acción desde la web.
- La acción de panel `next` muestra el siguiente en el panel; **no envía todavía un mensaje al chat**. El comando `!siguiente` sí lo anuncia.
- No hay límite de tamaño ni timeout de cola. Hay rate limiting de Twitch para mensajes; añadir límites para despliegues con mayor tráfico.
- EventSub requiere dominio público HTTPS y secretos configurados. Los mensajes duplicados no reejecutan comandos; errores después de reservar el evento requieren revisión manual.
- La lista pública deja visibles los nombres de usuario; para uso privado se puede proteger la ruta de consulta.
- En producción usar un `ADMIN_PASSWORD` fuerte. El secreto se mantiene solo en memoria de la pestaña y se envía exclusivamente a tu servidor.
- PostHog solo Error Tracking, sin session replay ni autocapture, según la plantilla. Falta configurar token/host y validar errores en producción.
- Necesario revisar la UI con Impeccable e instalarla antes de considerarla lista para producción.

## Desarrollo

`npm run typecheck` · `npm run build` · `npm run db:generate` · `npm run db:migrate`

## Connect with Twitch (OAuth button)

The panel includes **Conectar con Twitch**. This MVP uses a single account: the Twitch channel owner is also the bot identity, so bot responses are posted under the streamer's Twitch username.

1. Create a **Confidential** Twitch developer app at https://dev.twitch.tv/console/apps with exact OAuth callback: `https://twitch-bot-ivan0013.vercel.app/api/auth/twitch/callback`.
2. On Vercel set `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_TOKEN_ENCRYPTION_KEY` (32-byte hexadecimal AES key), `TWITCH_EVENTSUB_SECRET` (random 10–100 char secret), `PUBLIC_BASE_URL=https://twitch-bot-ivan0013.vercel.app`, `DATABASE_URL` and `ADMIN_PASSWORD`. Keep all secrets server-side. Deploy after updating env vars.
3. Run `npm run db:generate && npm run db:migrate` against the configured Neon database before connecting. The new `twitch_accounts` table stores AES-256-GCM encrypted OAuth tokens.
4. Enter the admin password in the panel and click **Conectar con Twitch**. Approve the scopes in Twitch, and you will return to the dashboard.
5. The callback exchanges the code, retrieves your Twitch user ID, stores the encrypted OAuth token pair, and attempts to register a signed EventSub webhook. The status endpoint exposes only public username and connection readiness, not tokens.

Notes:
- OAuth uses random state in a 10-minute HttpOnly Secure SameSite=Lax cookie; callbacks reject mismatches.
- The button is intentionally disabled if Vercel lacks required settings. Demo queue works independently.
- User tokens refresh on a 401 response while sending chat; refreshed tokens are encrypted and persisted. Twitch may invalidate them and require reconnecting.
- Webhook retries and deduplication are not fully reliable after an event is reserved and before its handler completes; production reliability hardening is pending.
- One Twitch account per deployment; connecting a different account replaces the saved owner. There is currently no separate dedicated bot-account onboarding.
