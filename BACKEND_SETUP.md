# Sidya Global Backend/Auth/Storage Setup

This project uses Supabase for the B2B customer portal:

- Auth: buyer registration and login
- Storage: private B2B document uploads
- Database: onboarding request records

## 1. Create Supabase Project

1. Go to Supabase and create a project.
2. Open `SQL Editor`.
3. Run `supabase/schema.sql`.

This creates:

- `b2b_onboarding_requests`
- private `b2b-documents` storage bucket
- row-level security policies so buyers only see/upload their own files

## 2. Configure Site

Open `backend-config.js` and fill:

```js
window.SIDYA_BACKEND = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_PUBLIC_ANON_KEY",
  storageBucket: "b2b-documents",
};
```

The anon key is public by design. Do not put the Supabase service role key in this website.

## 3. Deploy

Commit and push after filling `backend-config.js`.

For production, keep the storage bucket private. Buyers must sign in before uploading files.

## 4. Current Behavior

If Supabase config is empty:

- the form falls back to an email draft
- files are not stored

If Supabase config is filled and the buyer is signed in:

- selected files upload to `b2b-documents/{user_id}/...`
- onboarding request is inserted into `b2b_onboarding_requests`
