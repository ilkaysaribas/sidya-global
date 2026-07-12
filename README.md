Exit code: 0
Wall time: 4.8 seconds
Output:
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
3. Confirm the production Supabase URL contains project ref `jhjforyykkxklfarjtjl`.
4. Push `main` and verify the Vercel deployment commit SHA.
5. Verify the production URL in Turkish, English, and Arabic.
6. Check proforma, exchange-rate API, Supabase requests, browser console, and responsive layouts.
7. Confirm the footer build SHA matches the deployed GitHub commit.

