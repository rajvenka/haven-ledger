# Deploy Haven Ledger to Vercel (free)

1. Install the Vercel CLI if you don't have it:
   npm i -g vercel

2. From this folder, run:
   vercel --prod

   - First run will ask you to log in (opens browser) and link/create a project.
   - It auto-detects Vite and builds correctly.

3. When prompted for environment variables (or afterwards in the Vercel
   dashboard -> Project -> Settings -> Environment Variables), the values are
   already in `.env.production` in this folder, so Vercel will pick them up
   automatically during build — no manual entry needed:
     VITE_SUPABASE_URL
     VITE_SUPABASE_ANON_KEY

That's it — you'll get a live https://your-project.vercel.app URL.

The Supabase database is already live and fully configured (tables,
security rules, and family-sharing logic) — nothing to set up there.
