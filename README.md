This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

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

## Authentication and access control

Protected application routes require a valid Supabase session and a role assigned
to that user's row in the `profiles` table. Accounts without a recognized role
are denied access; roles must be assigned administratively, not by the login
form. Configure `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in the deployment environment.

Page access is restricted by role:

| Role | Pages |
| --- | --- |
| Super Admin | All application pages |
| AR Creator | Dashboard, Import, Master POS / Draft, Create Invoice, Invoice List, Status Approval |
| Approval Manager | Dashboard, Approval Queue, Invoice List, Approved Invoices, Status Approval |
| Accounting & Tax | Dashboard, Invoice List, Approved Invoices, Accounting Reports, e-Faktur Export |

The **Import WPP (Excel)** page parses an Excel recap. Save the parsed rows to
**Master POS / Draft** to review or update Grand Total, whose tax breakdown is
recalculated from the existing invoice calculation rules. Select one or more
Draft rows in Master POS to continue to **Create Invoice**. Draft/import
staging remains in this browser; submitted invoices, approval decisions, and
approved invoice changes are shared through Supabase.

### Invoice workflow database setup

Before deploying this workflow change, apply
[`supabase/migrations/20261024214500_invoice_workflows.sql`](./supabase/migrations/20261024214500_invoice_workflows.sql)
to the intended Supabase project using its SQL Editor (or an already configured
Supabase migration workflow). The migration expects `public.profiles` to have
`id`, `role`, and `full_name` columns. It creates the invoice workflow table,
row-level read policy, and role-checked RPCs for submission, approval,
rejection, printing, payment updates, and deletion.

Submitted invoices already stored in browser storage are **not** imported by
this migration; treat them as untrusted and verify/migrate any required records
through an authorized process. Verify the migration and role-specific behavior
in the target Supabase project before deploying the frontend. Configure
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the deployment
environment.

Route checks do not secure data by themselves. Invoice workflow mutations are
enforced by Supabase RPC role checks and Row Level Security, while unsent
draft/import staging is still stored in browser storage. The browser-based
Supabase session also does not provide an HttpOnly cookie; use server-managed
sessions before treating it as an XSS-resistant authentication boundary.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
