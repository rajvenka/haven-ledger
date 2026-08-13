# Daily digests — Email + WhatsApp

## 1. Database (Supabase SQL)

```sql
alter table profiles
  add column if not exists digest_email boolean default false,
  add column if not exists digest_whatsapp boolean default false;
```

## 2. Vercel env

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
RESEND_API_KEY=
RESEND_FROM=Haven Ledger <onboarding@resend.dev>
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_BUSINESS_DISPLAY=
```

## 3. Meta webhook
Callback: https://YOUR_DOMAIN/api/whatsapp-webhook
Verify token = WHATSAPP_VERIFY_TOKEN
Subscribe: messages

## 4. Resend
https://resend.com — free tier. API key + from address.

## 5. Cron
vercel.json schedules GET/POST /api/daily-digest at 0 22 * * * UTC (~08:00 AEST).
Vercel sends Authorization automatically if configured; otherwise protect with CRON_SECRET and set cron header in project settings.

Manual test:
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/daily-digest
