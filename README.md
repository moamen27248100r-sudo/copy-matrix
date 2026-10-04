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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Crypto wallet (USDT deposits / withdrawals)

Network settings (deposit address, minimums, confirmations, fees, limits, on/off) are edited in the
admin panel at `/admin/crypto-networks`. Deposits are verified on-chain by TxID (`src/lib/crypto`);
withdrawals are executed by the back office at `/admin/withdrawals`. Migration:
`supabase/migrations/0233_crypto_wallet.sql` (rollback in `supabase/rollback/`).

Environment variables (Vercel → Project → Settings → Environment Variables):

| Variable | Required | Purpose |
| --- | --- | --- |
| `ETHERSCAN_API_KEY` | yes | Etherscan API V2 key, verifies BEP20 (chain 56) and ERC20 (chain 1) deposits |
| `TRONGRID_API_KEY` | recommended | TronGrid key for TRC20 (works without one at a lower rate limit) |
| `CRON_SECRET` | yes | Secret for `/api/cron/crypto-deposits` (re-checks deposits awaiting confirmations) |
| `BSC_RPC_URL` / `ETH_RPC_URL` | optional | JSON-RPC endpoint used instead of Etherscan for that network |
| `ALLOW_SEARCH_INDEXING` | at launch | `true` lets search engines index the site; unset = noindex everywhere |

The database calls the cron route every minute (pg_cron + pg_net). It reads the URL and secret
from Supabase Vault; run once in the Supabase SQL editor with the same secret as `CRON_SECRET`:

```sql
select vault.create_secret('https://<your-domain>/api/cron/crypto-deposits', 'crypto_cron_url');
select vault.create_secret('<CRON_SECRET value>', 'crypto_cron_secret');
```
