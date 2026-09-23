import Link from 'next/link';
import { FileSpreadsheet, Clock, CheckCircle, FileText } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Invoicing Dashboard</h1>
        <p className="text-sm text-stone-500">
          Manage POS WPP data, automated invoice creation, and approval workflows.
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total Invoices</span>
            <FileText className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-stone-800 mt-2">1</p>
          <span className="text-[11px] text-stone-400">Current period</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Pending Approval</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-stone-800 mt-2">0</p>
          <span className="text-[11px] text-amber-600 font-medium">Needs review</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Approved</span>
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-stone-800 mt-2">1</p>
          <span className="text-[11px] text-emerald-600 font-medium">Ready for download</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Uploaded WPP</span>
            <FileSpreadsheet className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-stone-800 mt-2">3</p>
          <span className="text-[11px] text-stone-400">Ready to process</span>
        </div>
      </div>

      {/* Quick Action */}
      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-stone-800">Create Invoice from Excel Recap</h2>
          <p className="text-xs text-stone-500 mt-1">
            Upload Excel files to process net pricing, select store items, and generate new invoices.
          </p>
        </div>
        <Link
          href="/create-invoice"
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
        >
          <FileSpreadsheet size={18} />
          Create Invoice
        </Link>
      </div>
    </div>
  );
}