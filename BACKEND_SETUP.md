# Sidya Global Backend/Auth/Storage Setup

This project uses Supabase for the B2B customer portal:

- Auth: buyer registration and login
- Storage: private B2B document uploads
- Database: onboarding request records

The site also includes `/api/b2b-request`, a Vercel serverless mail fallback for sending B2B request forms with uploaded documents.

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

## 4. Mail Upload Fallback

To receive B2B form documents by email without Supabase storage, add these Vercel environment variables:

```txt
RESEND_API_KEY=your_resend_api_key
B2B_TO_EMAIL=info@sidyaglobal.com
B2B_FROM_EMAIL=Sidya Global <onboarding@sidyaglobal.com>
```

`B2B_FROM_EMAIL` must be a verified sender/domain in Resend.

## 5. Current Behavior

If Supabase config is empty:

- the customer account panel shows email/upload mode
- the form tries `/api/b2b-request` first
- if Resend is not configured, the form falls back to an email draft
- browser mail drafts cannot attach files automatically, so the buyer must attach them manually in that fallback

If Supabase config is filled and the buyer is signed in:

- selected files upload to `b2b-documents/{user_id}/...`
- onboarding request is inserted into `b2b_onboarding_requests`
