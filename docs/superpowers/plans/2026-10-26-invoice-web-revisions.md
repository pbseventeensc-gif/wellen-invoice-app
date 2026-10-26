# Implementation Plan: Web Invoice Revisions (10 Points)

## Goal
Implement the 10 requested revisions to the Wellen invoice web app:
1. Clear sample data (database online & local storage), accessible exclusively to users with the Approval role.
2. Grant AR Creator access to the Approval Queue page and sidebar, with a "Show Internal Total" toggle.
3. Empty Master POS / Draft state after Excel import by Creator.
4. Correct the Total calculation in Create Invoice Form (display Total DPP instead of gross amount so math is consistent: Total DPP + VAT = Grand Total).
5. Enable "Show Internal Total" on the Approval preview sheet and support printing with internal totals.
6. Display Rupiah amounts on the status metric cards in `/invoices`.
7. Position the Approver name above "Authorized Sign,", enlarge digital signature & stamp, and refine alignment.
8. Professional, colorful, and clean styling for Import Excel page.
9. Add a Reset Filter icon button to the Invoices table.
10. Update company office address to `Jl. Raya Pasar Minggu No.49, RT.2/RW.7, Duren Tiga, Jakarta Selatan`, phone to `(021) 79188868`, and email to `finance@wellenprint.com`.

---

## Task Decomposition

### Task 1: Update Company Address, Phone & Email (Point 10)
- **Files**:
  - `src/app/approval/page.jsx`
  - `src/components/invoice-print/PrintModal.jsx`
- **Actions**:
  - Change address to `Jl. Raya Pasar Minggu No.49, RT.2/RW.7, Duren Tiga, Jakarta Selatan`.
  - Change phone to `(021) 79188868`.
  - Ensure email is `finance@wellenprint.com`.

### Task 2: Correct Calculation in Create Invoice Form (Point 4)
- **Files**:
  - `src/app/create-invoice/page.jsx`
- **Actions**:
  - In the summary box, change the displayed `TOTAL:` to show `totalDppOverall` for POS mode (or when prices include VAT) instead of `totalPoNetOverall`.
  - Verify that `TOTAL (Rp 1.801.802) + VAT (Rp 198.198) = GRAND TOTAL (Rp 2.000.000)`.

### Task 3: Display Rupiah Amount on Invoices Status Cards (Point 6)
- **Files**:
  - `src/app/invoices/page.jsx`
- **Actions**:
  - Calculate `totalAmount` for each of the 4 cards: All records, Draft, Waiting Approval, Approved.
  - Render `formatRupiah(card.totalAmount)` prominently beneath each count.

### Task 4: Add Reset Filter Icon in Invoices Table (Point 9)
- **Files**:
  - `src/app/invoices/page.jsx`
- **Actions**:
  - Import `RotateCcw` from `lucide-react`.
  - Add button in the filter bar to reset `fromDate`, `toDate`, `clientFilter`, `statusFilter`, `search`, and sorting back to defaults.

### Task 5: Approval Signature & Stamp Formatting (Point 7)
- **Files**:
  - `src/app/approval/page.jsx`
  - `src/components/invoice-print/PrintModal.jsx`
- **Actions**:
  - Enlarge digital signature and stamp images.
  - Position approver name above `Authorized Sign`.
  - Ensure clean border line and typography.

### Task 6: Permissions & Approval Queue for Creator with Show Internal Total (Points 2 & 5)
- **Files**:
  - `src/config/permissions.js`
  - `src/app/approval/page.jsx`
  - `src/components/invoice-print/PrintModal.jsx`
- **Actions**:
  - Add `/approval` and `/import` to `ar created` allowedPages.
  - Add toggle "Show Internal Total" / "Hide Internal Total" (with Eye / EyeOff icon) in `/approval`.
  - When enabled, show internal DPP Nilai Lain breakdown in both the on-screen preview and the print view.
  - Hide "Approve" and "Reject / Revise" buttons when user is `ar created`.

### Task 7: Empty Master POS / Draft State upon Import (Point 3)
- **Files**:
  - `src/components/import/ImportExcelTab.jsx`
- **Actions**:
  - In `handleSaveToMasterPos`, reset `importedRows`, `selectedIds`, `fileName`, `detectedClient`, `detectedPromo` upon successful save so the import form is cleanly emptied.

### Task 8: Clear Sample Data Online & Local (Restricted to Approval) (Point 1)
- **Files**:
  - `supabase/migrations/20261026182000_clear_all_sample_data.sql`
  - `src/utils/invoiceWorkflow.js`
  - `src/components/sidebar/WhiteSubpanel.jsx`
- **Actions**:
  - Create Supabase RPC `clear_all_invoice_data()` that restricts deletion to `'super admin'` and `'approval'` roles and clears `invoice_workflows` and `invoice_staging`.
  - Only show "Clear Sample Data" in `WhiteSubpanel.jsx` if user has role `'approval'` or `'super admin'`.
  - When confirmed, call the RPC and clear local & session storage.

### Task 9: Professional Styling for Import Excel (Point 8)
- **Files**:
  - `src/app/import/page.jsx`
  - `src/components/import/ImportExcelTab.jsx`
- **Actions**:
  - Refine color palette, typography, badges, and layout for enterprise-grade feel.
