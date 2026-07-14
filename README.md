# Sidya Global production architecture

## Canonical production path

- GitHub: `ilkaysaribas/sidya-global`
- Branch: `main`
- Vercel: `sidya-global` (`prj_LnnqEsTUmjyiyMnqpmRJAieiIrTU`)
- Supabase: `sidya-global` (project ref `jhjforyykkxklfarjtjl`)
- Vercel Root Directory: repository root (`.`)
- Framework preset: Other / static site with Vercel Functions
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: repository root

The historical Vercel project `sidya-global-web` must not be used for production. Do not attach production domains or Git auto-deployments to it.

## Environment variables

Public browser configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- `SUPABASE_STORAGE_BUCKET`

Server-only configuration:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ACCESS_TOKEN`
- `MIGRATION_ADMIN_KEY`
- `SMTP_ENCRYPTION_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`
- `RESEND_API_KEY` when the Resend fallback is enabled

Never expose the service-role key in browser code or commit secret values. The `mobile/` Expo application legitimately uses `EXPO_PUBLIC_*`; the production web application does not.

## Deployment checklist

1. Confirm `git remote -v`, branch `main`, and a clean worktree.
2. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
3. Run `VALIDATE_PRODUCTION_ENV=1 npm run build` in a production environment and confirm the Supabase URL contains project ref `jhjforyykkxklfarjtjl`.
4. Push `main` and verify the Vercel deployment commit SHA.
5. Verify the production URL in Turkish, English, and Arabic.
6. Check proforma, exchange-rate API, Supabase requests, browser console, and responsive layouts.
7. Confirm the footer build SHA matches the deployed GitHub commit.

## Sidya AI Assistant

The production site loads the assistant lazily through `/api/backend-config.js`. The public browser never receives the OpenAI key or Supabase service-role key.

- UI: `sidya-ai-assistant.js` and `sidya-ai-assistant.css`
- Server API: `api/ai-assistant.js`
- Admin view: `admin-ai-assistant.js`
- Database migration: `supabase/ai-assistant-leads.sql`
- Storage bucket: private `ai-assistant-attachments`
- Notification recipient: `export@sidyaglobal.com`
- Supported languages: Turkish, English, Arabic, Russian, Georgian and Azerbaijani
- AI provider: OpenAI Responses API when `OPENAI_API_KEY` is set; safe multilingual knowledge fallback otherwise
- Mail provider: the existing Mail Center / Nodemailer SMTP configuration

Required server variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` and optional `OPENAI_MODEL`
- Existing SMTP variables or encrypted Mail Center settings

The API applies per-IP rate limits, honeypot and elapsed-time spam checks, server-side validation and sanitization. Lead tables have RLS enabled and no anonymous grants; public submissions pass only through the server API.
