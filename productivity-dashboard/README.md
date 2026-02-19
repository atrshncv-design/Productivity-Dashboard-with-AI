This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Notifications Setup

The app supports 2 reminder channels:
- Browser notifications (PWA/web push while app is open)
- Telegram fallback channel

Required env for Telegram:

```bash
TELEGRAM_BOT_TOKEN=your-bot-token
CRON_SECRET=your-long-random-cron-secret
```

How to enable Telegram reminders:
1. Open dashboard -> notifications settings
2. Enable `Telegram channel`
3. Paste your `chat_id`
4. Click `Test Telegram`

How to get `chat_id`:
- Message `@userinfobot` or `@RawDataBot` in Telegram
- Start a chat with your bot at least once

## Server-Side Reminder Cron

To deliver reminders when the browser is closed, call this endpoint every 5 minutes:

```bash
POST /api/cron/notifications
Authorization: Bearer <CRON_SECRET>
```

This project includes a GitHub Actions schedule:
- `/.github/workflows/notifications-cron.yml`

Set repository secrets:
- `APP_BASE_URL` (for example `https://your-app.netlify.app`)
- `CRON_SECRET` (must match app env value)

## Google Sheets Migration

This app uses Google Sheets via `service_account` credentials, not by API key alone.

To migrate all app data from old spreadsheet/account to new one:

1. Ensure source and target spreadsheets are shared with corresponding service account emails.
2. Set env vars:
   - `SOURCE_GOOGLE_SHEETS_ID`
   - `TARGET_GOOGLE_SHEETS_ID`
   - `GOOGLE_SHEETS_SOURCE_CREDENTIALS` (optional)
   - `GOOGLE_SHEETS_TARGET_CREDENTIALS` (optional)
3. Run:

```bash
node scripts/migrate-sheets-data.js
```

If source/target credentials are not set, script falls back to `GOOGLE_SHEETS_CREDENTIALS`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
