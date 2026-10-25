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
| AR Creator | Select shared POS Drafts, Create Invoice |
| Approval Manager | All application pages, including Import |
| Accounting & Tax | Dashboard, Invoice List, Approved Invoices, Accounting Reports, e-Faktur Export |

The **Import WPP (Excel)** page parses an Excel recap. Save the parsed rows to
**Master POS / Draft** to review or update Grand Total, whose tax breakdown is
recalculated from the existing invoice calculation rules. POS drafts and
remaining PO items are stored in Supabase so authorized users see the same
staging data. Select one or more Draft rows to continue to **Create Invoice**.
Approval Managers and Super Admins can import and manage shared POS drafts. AR
Creators can select existing shared POS Drafts, create invoices, and submit
them for approval; they cannot import or edit drafts or view other invoices.
Submitted invoices, approval decisions, and approved invoice changes are also
shared through Supabase.

### Invoice workflow database setup

Before deploying this workflow change, apply
[`supabase/migrations/20261024214500_invoice_workflows.sql`](./supabase/migrations/20261024214500_invoice_workflows.sql)
to the intended Supabase project using its SQL Editor (or an already configured
Supabase migration workflow). The migration expects `public.profiles` to have
`id`, `role`, and `full_name` columns. It creates the invoice workflow table,
row-level read policy, and role-checked RPCs for submission, approval,
rejection, printing, payment updates, and deletion.

Approval Managers may import POS/PO data and submit invoices for approval.
Apply the follow-up migration
[`supabase/migrations/20261024223800_allow_approval_manager_invoice_submission.sql`](./supabase/migrations/20261024223800_allow_approval_manager_invoice_submission.sql)
after the initial workflow migration; it adds this role to the server-side
invoice-submission check.

Apply the shared-draft migration
[`supabase/migrations/20261024225500_shared_invoice_staging.sql`](./supabase/migrations/20261024225500_shared_invoice_staging.sql)
after both workflow migrations. It creates the RLS-protected staging table and
role-checked RPCs for importing, editing, and deleting shared POS drafts, with
draft lifecycle updates tied transactionally to invoice workflow changes.

Apply
[`supabase/migrations/20261025115900_limit_ar_creator_access.sql`](./supabase/migrations/20261025115900_limit_ar_creator_access.sql)
after the shared-draft migration. It restricts AR Creator reads to actionable
POS drafts and prevents that role from reading invoice workflows or importing,
editing, or deleting shared drafts. Approval Managers and Super Admins retain
shared-draft management access.

Existing browser-only drafts and invoices are **not** imported by these
migrations; re-import required draft data and verify/migrate any required
submitted invoices through an authorized process. Verify all migrations and
role-specific behavior in the target Supabase project before deploying the
frontend. Configure
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the deployment
environment.

Route checks do not secure data by themselves. Invoice workflow and draft
mutations are enforced by Supabase RPC role checks and Row Level Security. The
browser-based Supabase session also does not provide an HttpOnly cookie; use
server-managed sessions before treating it as an XSS-resistant authentication
boundary.

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
