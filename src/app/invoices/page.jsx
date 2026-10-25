'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpDown,
  BadgeCheck,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FilePlus2,
  Layers3,
  Lock,
  Pencil,
  Printer,
  Search,
  Unlock,
  UserCheck,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { normalizeRole } from '@/config/permissions';
import {
  approveInvoiceWorkflow,
  listInvoiceWorkflows,
  markInvoiceWorkflowPrinted,
} from '@/utils/invoiceWorkflow';
import {
  claimInvoiceStagingRows,
  listInvoiceStaging,
  releaseInvoiceStagingRows,
  updateInvoiceStagingRow,
} from '@/utils/invoiceStaging';
import { calculateFakturBreakdown, formatRupiah, parseCurrencyNumber } from '@/utils/taxCalculator';
import FeedbackDialog from '@/components/ui/FeedbackDialog';
import PrintModal from '@/components/invoice-print/PrintModal';
import TablePagination from '@/components/ui/TablePagination';
import {
  getUnreadStatusCounts,
  markInvoiceStatusSeen,
  saveUnreadStatusCounts,
} from '@/utils/invoiceNotifications';

function getMonthYear(row) {
  if (row.month_year) return String(row.month_year).slice(0, 7);
  const date = row.import_date || row.invoice_date || row.time_created || row.time_approved;
  return date ? String(date).slice(0, 7) : '';
}

function toInvoiceRow(row, status, id, invoiceNo) {
  const transactionLines = Array.from(new Map((row.items || [])
    .map((item) => ({
      no_wpp: item.source_no_wpp || item.wpp_number || item.no_faktur || '',
      store_name: String(item.store_name || item.item_description || '').trim(),
    }))
    .filter((item) => item.no_wpp || item.store_name)
    .map((item, index) => [`${item.no_wpp}-${item.store_name}`, { ...item, id: `${item.no_wpp}-${item.store_name}-${index}` }])
  ).values());
  const sourceWppNumbers = Array.from(new Set(transactionLines.map((item) => item.no_wpp).filter(Boolean)));
  const storeNames = Array.from(new Set(transactionLines.map((item) => item.store_name).filter(Boolean)));
  const noWpp = row.no_wpp || sourceWppNumbers.join(', ') || row.wpp_number || row.no_faktur || row.invoice_number || '';
  const noWppLines = String(noWpp).split(/\s*,\s*/).filter(Boolean);
  const storeNameLines = storeNames.length ? storeNames : String(row.store_name || '').split(/\s*,\s*/).filter(Boolean);
  const alignedLines = noWppLines.map((number, index) => ({
    no_wpp: number,
    store_name: transactionLines[index]?.store_name || storeNameLines[index] || '',
  }));
  return {
    ...row,
    id,
    invoice_no: invoiceNo || row.invoice_no || row.invoice_number || '',
    status,
    claimed_by_id: row.claimed_by_id || null,
    claimed_by_name: row.claimed_by_name || null,
    claimed_at: row.claimed_at || null,
    no_wpp: noWpp,
    transaction_lines: alignedLines,
    client_name: row.client_name || row.customer || '-',
    store_name: storeNameLines.join(', ') || '-',
    created_by: row.created_by || row.ar_name || '',
    approved_by: row.approved_by || row.approver_name || '',
    import_date: row.import_date || row.invoice_date || row.time_created || '',
    month_year: getMonthYear(row),
    created_invoice_at: row.created_invoice_at || row.time_created || '',
    approved_at: row.approved_at || row.time_approved || '',
    grand_total: Number(row.grand_total ?? row.total_price ?? row.total_faktur ?? row.nilai_wpp ?? 0),
  };
}

function getAllRows(workflows, staging) {
  const rows = [];
  const activeItemIds = new Set();
  const activeSourceNumbers = new Set();

  workflows.filter((invoice) => invoice.status === 'waiting_approval').forEach((invoice) => {
    (invoice.items || []).forEach((item) => {
      if (item.id) activeItemIds.add(item.id);
      [item.source_no_wpp, item.wpp_number, item.no_faktur].forEach((number) => {
        const normalizedNumber = String(number || '').trim().toLowerCase();
        if (normalizedNumber) activeSourceNumbers.add(normalizedNumber);
      });
    });
    rows.push(toInvoiceRow(invoice, 'Invoiced', invoice.id, invoice.invoice_number));
  });
  workflows.filter((invoice) => invoice.status === 'approved').forEach((invoice) => {
    (invoice.items || []).forEach((item) => {
      if (item.id) activeItemIds.add(item.id);
      [item.source_no_wpp, item.wpp_number, item.no_faktur].forEach((number) => {
        const normalizedNumber = String(number || '').trim().toLowerCase();
        if (normalizedNumber) activeSourceNumbers.add(normalizedNumber);
      });
    });
    rows.push(toInvoiceRow(invoice, 'Approved', invoice.id, invoice.invoice_number));
  });

  staging.forEach((item) => {
    if (!['draft', 'ready', 'ready_to_process', 'rejected'].includes(String(item.status || '').toLowerCase())) return;
    const sourceNumbers = [item.source_no_wpp, item.wpp_number, item.no_faktur]
      .map((number) => String(number || '').trim().toLowerCase())
      .filter(Boolean);
    if (activeItemIds.has(item.id) || sourceNumbers.some((number) => activeSourceNumbers.has(number))) return;
    const sourceStatus = String(item.status || '').toLowerCase();
    const status = sourceStatus === 'rejected'
      ? 'Rejected'
      : 'Draft';
    rows.push(toInvoiceRow(item, status, item.id, item.invoice_no || item.invoice_number));
  });

  return Array.from(new Map(rows.map((row) => [row.id || `${row.invoice_no}-${row.no_wpp}`, row])).values())
    .sort((a, b) => String(b.import_date).localeCompare(String(a.import_date)));
}

function displayDate(value, includeTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }
  ).format(date);
}

function getCurrentMonthDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function InvoiceFilterDropdown({ label, value, options, onChange, widthClass = 'min-w-[150px]' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative flex flex-col gap-1 text-[11px] font-medium text-slate-500">
      <span>{label}</span>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`inline-flex h-9 ${widthClass} items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-2.5 text-left text-xs font-normal text-slate-700 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-100`}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-2 w-max min-w-full max-w-[min(22rem,90vw)] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  isSelected
                    ? 'bg-amber-50 font-semibold text-amber-800'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex-1 whitespace-nowrap">{option.label}</span>
                {isSelected && <Check size={16} className="shrink-0 text-amber-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function InvoiceListPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [role, setRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [claimFilter, setClaimFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const initialDateRange = getCurrentMonthDateRange();
  const [fromDate, setFromDate] = useState(initialDateRange.from);
  const [toDate, setToDate] = useState(initialDateRange.to);
  const [sortBy, setSortBy] = useState('import_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingDraftTotals, setEditingDraftTotals] = useState({});
  const [selectedDraftIds, setSelectedDraftIds] = useState([]);
  const [selectedPrintIds, setSelectedPrintIds] = useState([]);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);

  const loadRows = async () => {
    try {
      const [workflows, staging] = await Promise.all([
        listInvoiceWorkflows(),
        listInvoiceStaging(),
      ]);
      const nextRows = getAllRows(workflows, staging);
      setRows(nextRows);
      saveUnreadStatusCounts(getUnreadStatusCounts(nextRows));
    } catch (error) {
      console.error('Failed to load invoice list:', error);
      setFeedback({
        variant: 'error',
        title: 'Invoices could not be loaded',
        description: 'The shared invoice workflow could not be reached. Check your connection and Supabase access, then try again.',
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadRole = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Failed to load invoice-list permissions:', authError);
        return;
      }
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Failed to load invoice-list permissions:', error);
        return;
      }
      if (isMounted) {
        const normalizedRole = normalizeRole(data?.role);
        setRole(normalizedRole);
        setCurrentUser({
          id: user.id,
          name: data?.full_name || user.email?.split('@')[0] || 'User',
          role: normalizedRole,
        });
        if (normalizedRole === 'ar created') setStatusFilter('Draft');
      }
    };
    const loadTimer = window.setTimeout(loadRows, 0);
    loadRole();
    window.addEventListener('storage', loadRows);
    window.addEventListener('wellen-invoice-workflows', loadRows);
    window.addEventListener('wellen-invoice-staging', loadRows);
    window.addEventListener('focus', loadRows);
    const refreshInterval = window.setInterval(loadRows, 30000);
    return () => {
      isMounted = false;
      window.clearTimeout(loadTimer);
      window.removeEventListener('storage', loadRows);
      window.removeEventListener('wellen-invoice-workflows', loadRows);
      window.removeEventListener('wellen-invoice-staging', loadRows);
      window.removeEventListener('focus', loadRows);
      window.clearInterval(refreshInterval);
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedInvoice(null);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const clients = useMemo(
    () => Array.from(new Set(rows.map((row) => row.client_name).filter((client) => client && client !== '-'))).sort(),
    [rows]
  );
  const matchingRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        const matchesSearch = !query || [row.invoice_no, row.no_wpp, row.client_name, row.store_name, row.claimed_by_name]
          .some((value) => String(value || '').toLowerCase().includes(query));
        const matchesClient = clientFilter === 'ALL' || row.client_name === clientFilter;
        const date = String(row.import_date || '').slice(0, 10);
        const matchesFrom = !fromDate || date >= fromDate;
        const matchesTo = !toDate || date <= toDate;
        return matchesSearch && matchesClient && matchesFrom && matchesTo;
      });
  }, [rows, search, clientFilter, fromDate, toDate]);

  const draftStats = useMemo(() => {
    const drafts = matchingRows.filter((row) => row.status === 'Draft');
    const available = drafts.filter((row) => !row.claimed_by_id).length;
    const myDrafts = drafts.filter((row) => currentUser?.id && row.claimed_by_id === currentUser.id).length;
    const otherAr = drafts.filter((row) => row.claimed_by_id && row.claimed_by_id !== currentUser?.id).length;
    return { total: drafts.length, available, myDrafts, otherAr };
  }, [matchingRows, currentUser]);

  const filteredRows = useMemo(() => {
    return matchingRows
      .filter((row) => {
        if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
        if (statusFilter === 'Draft' || role === 'ar created') {
          if (claimFilter === 'AVAILABLE') return !row.claimed_by_id;
          if (claimFilter === 'MY_DRAFTS') return Boolean(currentUser?.id && row.claimed_by_id === currentUser.id);
          if (claimFilter === 'OTHER_AR') return Boolean(row.claimed_by_id && row.claimed_by_id !== currentUser?.id);
        }
        return true;
      })
      .sort((a, b) => {
        const getValue = (row) => {
          if (sortBy === 'created_invoice_at') return row.created_invoice_at || '';
          if (sortBy === 'invoice_no') return row.invoice_no || '';
          if (sortBy === 'client_name') return row.client_name || '';
          if (sortBy === 'grand_total') return row.grand_total;
          return row.import_date || '';
        };
        const valueA = getValue(a);
        const valueB = getValue(b);
        const comparison = typeof valueA === 'number' && typeof valueB === 'number'
          ? valueA - valueB
          : String(valueA).localeCompare(String(valueB), 'id', { numeric: true, sensitivity: 'base' });
        return sortDirection === 'desc' ? -comparison : comparison;
      });
  }, [matchingRows, statusFilter, claimFilter, role, currentUser, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const printableRows = filteredRows.filter((row) => ['Invoiced', 'Approved'].includes(row.status));
  const draftRows = filteredRows.filter((row) => row.status === 'Draft');
  const selectedDraftRows = rows.filter((row) => row.status === 'Draft' && selectedDraftIds.includes(row.id));

  const handleClaimDrafts = async (draftIds) => {
    const ids = (Array.isArray(draftIds) ? draftIds : [draftIds]).filter(Boolean);
    if (ids.length === 0) return;
    try {
      const claimed = await claimInvoiceStagingRows(ids);
      const claimedKeys = new Set((claimed || []).map((r) => r.source_key));
      const failedCount = ids.length - claimedKeys.size;
      await loadRows();

      if (claimedKeys.size === ids.length) {
        setFeedback({
          variant: 'success',
          title: 'Draft claimed successfully',
          description: `${claimedKeys.size} draft(s) are now locked for you and ready to be invoiced.`,
        });
      } else if (claimedKeys.size > 0) {
        setFeedback({
          variant: 'success',
          title: 'Some drafts claimed',
          description: `${claimedKeys.size} draft(s) claimed. ${failedCount} draft(s) were already claimed by another AR.`,
        });
      } else {
        setFeedback({
          variant: 'error',
          title: 'Failed to claim draft',
          description: 'The selected draft(s) are already claimed by another AR.',
        });
      }
    } catch (err) {
      console.error('Failed to claim drafts:', err);
      setFeedback({
        variant: 'error',
        title: 'Claim failed',
        description: err.message || 'An error occurred while claiming the draft.',
      });
    }
  };

  const handleReleaseDrafts = async (draftIds) => {
    const ids = (Array.isArray(draftIds) ? draftIds : [draftIds]).filter(Boolean);
    if (ids.length === 0) return;
    try {
      await releaseInvoiceStagingRows(ids);
      await loadRows();
      setSelectedDraftIds((curr) => curr.filter((id) => !ids.includes(id)));
      setFeedback({
        variant: 'success',
        title: 'Claim released',
        description: `${ids.length} draft(s) returned to available pool for other AR.`,
      });
    } catch (err) {
      console.error('Failed to release drafts:', err);
      setFeedback({
        variant: 'error',
        title: 'Failed to release claim',
        description: err.message || 'An error occurred while releasing the draft.',
      });
    }
  };

  const handleDraftGrandTotalChange = async (rowId, value) => {
    const grandTotal = parseCurrencyNumber(value);
    const breakdown = calculateFakturBreakdown(grandTotal);
    try {
      const draft = rows.find((row) => row.id === rowId);
      if (!draft) throw new Error('The selected shared draft was not found.');
      await updateInvoiceStagingRow(rowId, {
        ...draft,
        grand_total: grandTotal,
        raw_total: grandTotal,
        total_faktur: grandTotal,
        total_price: grandTotal,
        nilai_wpp: grandTotal,
        unit_price: grandTotal,
        dpp: breakdown.dpp,
        nilai_barang: breakdown.nilaiBarang,
        nilaiBarang: breakdown.nilaiBarang,
        jasa_cetak: breakdown.jasaCetak,
        jasaCetak: breakdown.jasaCetak,
        pph23: breakdown.pph23,
        wht: breakdown.wht,
        dpp_nilai_lain_barang: breakdown.dppNilaiLainBarang,
        dpp_nilai_lain_jasa_cetak: breakdown.dppNilaiLainJasaCetak,
        ppn: breakdown.ppn,
        updated_at: new Date().toISOString(),
      });
      await loadRows();
    } catch (error) {
      console.error('Failed to update draft grand total:', error);
      setFeedback({
        variant: 'error',
        title: 'Grand total could not be saved',
        description: 'The draft amount was not saved. Check connection and try again.',
      });
    }
  };

  const handleCreateInvoiceFromDrafts = async () => {
    if (selectedDraftRows.length === 0) {
      setFeedback({
        variant: 'error',
        title: 'No Draft selected',
        description: 'Select at least one Draft row from the Invoices list to start creating an invoice.',
      });
      return;
    }

    // Auto-claim unclaimed drafts before proceeding
    const unclaimedIds = selectedDraftRows
      .filter((row) => !row.claimed_by_id)
      .map((row) => row.id);

    if (unclaimedIds.length > 0) {
      try {
        const claimed = await claimInvoiceStagingRows(unclaimedIds);
        const claimedKeys = new Set((claimed || []).map((r) => r.source_key));
        if (claimedKeys.size < unclaimedIds.length) {
          await loadRows();
          setFeedback({
            variant: 'error',
            title: 'Draft already claimed by another AR',
            description: 'Some drafts you selected were just claimed by another AR. Draft list has been refreshed.',
          });
          return;
        }
      } catch (err) {
        console.error('Failed to claim drafts before creating invoice:', err);
        setFeedback({
          variant: 'error',
          title: 'Failed to lock draft',
          description: 'Could not lock drafts before creating invoice. Please try again.',
        });
        return;
      }
    }

    const stagedItems = selectedDraftRows.map((row) => ({
      ...row,
      no_faktur: row.no_faktur || row.wpp_number || row.no_wpp,
      wpp_number: row.wpp_number || row.no_faktur || row.no_wpp,
      item_description: row.item_description || row.store_name,
      store_name: row.store_name || row.item_description,
      total_faktur: Number(row.grand_total ?? row.total_faktur ?? row.total_price ?? 0),
      total_price: Number(row.grand_total ?? row.total_price ?? row.total_faktur ?? 0),
      status: 'draft',
    }));
    try {
      sessionStorage.setItem('wellen_import_source', 'excel');
      sessionStorage.setItem('wellen_staged_items', JSON.stringify(stagedItems));
      router.push('/create-invoice');
    } catch (error) {
      console.error('Failed to prepare selected drafts for invoice creation:', error);
      setFeedback({
        variant: 'error',
        title: 'Create Invoice could not be opened',
        description: 'The selected draft data could not be prepared. Please try again.',
      });
    }
  };

  const selectedPrintInvoices = printableRows.filter((row) => selectedPrintIds.includes(row.id));
  const visiblePrintableRows = paginatedRows.filter((row) => ['Invoiced', 'Approved'].includes(row.status));
  const visiblePrintableIds = useMemo(() => visiblePrintableRows.map((r) => r.id), [visiblePrintableRows]);
  const visibleDraftRows = paginatedRows.filter((row) => row.status === 'Draft');

  // Drafts that can be selected by the current user (not claimed by other AR)
  const selectableDrafts = useMemo(() => {
    return visibleDraftRows.filter((row) => {
      if (row.claimed_by_id && row.claimed_by_id !== currentUser?.id) return false;
      return true;
    });
  }, [visibleDraftRows, currentUser]);
  const selectableDraftIds = useMemo(() => selectableDrafts.map((r) => r.id), [selectableDrafts]);

  const allActionableSelected = (visiblePrintableRows.length === 0 || visiblePrintableRows.every((row) => selectedPrintIds.includes(row.id)))
    && (selectableDrafts.length > 0 && selectableDrafts.every((row) => selectedDraftIds.includes(row.id)))
    && (visiblePrintableRows.length + selectableDrafts.length > 0);

  const handleApprove = (invoice) => {
    setPendingApproval(invoice);
    setFeedback({
      variant: 'confirm',
      title: 'Approve this invoice?',
      description: `${invoice.invoice_no || invoice.no_wpp} will be marked as approved and removed from the AR queue.`,
      confirmLabel: 'Approve invoice',
    });
  };

  const confirmApproval = async () => {
    const invoice = pendingApproval;
    setFeedback(null);
    setPendingApproval(null);
    if (!invoice) return;
    try {
      await approveInvoiceWorkflow(invoice.id);
      window.dispatchEvent(new Event('wellen-invoice-workflows'));
      markInvoiceStatusSeen('Approved');
      loadRows();
      setSelectedInvoice(null);
      setFeedback({
        variant: 'success',
        title: 'Invoice approved',
        description: `${invoice.invoice_no || invoice.no_wpp} has been approved successfully.`,
      });
    } catch (error) {
      console.error('Failed to approve invoice:', error);
      loadRows();
      setFeedback({
        variant: 'error',
        title: 'Approval could not be completed',
        description: 'No approval was recorded. Please try again or contact an administrator.',
      });
    }
  };

  const exportToExcel = () => {
    const data = filteredRows.map((row) => ({
      'No Invoice': row.invoice_no || '-',
      Status: row.status,
      'No WPP': row.no_wpp,
      'Klien / Customer': row.client_name,
      'Store Name': row.store_name,
      'Created By': row.created_by || '-',
      'Approved By': row.approved_by || '-',
      'Tanggal Import': row.import_date,
      'Bulan & Tahun': row.month_year,
      'Timestamp Queue AR': row.created_invoice_at,
      'Timestamp Approved': row.approved_at,
      'Grand Total': row.grand_total,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices');
    XLSX.writeFile(workbook, 'wellen-invoices.xlsx');
  };

  const canApprove = role === 'approval' || role === 'super admin';
  const canSelectDraft = ['approval', 'super admin', 'ar created'].includes(role);
  const canEditDraft = ['approval', 'super admin'].includes(role);
  const statusOptions = [
    { value: 'ALL', label: 'All statuses' },
    { value: 'Invoiced', label: 'Invoiced' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
  ];
  const sortOptions = [
    { value: 'import_date:desc', label: 'Newest created' },
    { value: 'import_date:asc', label: 'Oldest created' },
    { value: 'created_invoice_at:desc', label: 'Newest invoice' },
    { value: 'client_name:asc', label: 'Customer A-Z' },
    { value: 'grand_total:desc', label: 'Grand total high to low' },
  ];
  const currentSortOption = `${sortBy}:${sortDirection}`;
  const invoiceCards = [
    { value: 'ALL', label: 'All records', icon: Layers3, color: 'text-slate-700', iconStyle: 'bg-slate-100 text-slate-600', count: matchingRows.length },
    { value: 'Draft', label: 'Draft', icon: Clock3, color: 'text-orange-800', iconStyle: 'bg-orange-50 text-orange-700', count: matchingRows.filter((row) => row.status === 'Draft').length },
    { value: 'Invoiced', label: 'Waiting Approval', icon: FilePlus2, color: 'text-amber-800', iconStyle: 'bg-amber-100 text-amber-700', count: matchingRows.filter((row) => row.status === 'Invoiced').length },
    { value: 'Approved', label: 'Approved', icon: BadgeCheck, color: 'text-emerald-700', iconStyle: 'bg-emerald-50 text-emerald-600', count: matchingRows.filter((row) => row.status === 'Approved').length },
  ];
  const visibleInvoiceCards = role === 'ar created'
    ? invoiceCards.filter((card) => ['Draft', 'Invoiced'].includes(card.value))
    : invoiceCards;
  const markStatusSeen = (status) => {
    markInvoiceStatusSeen(status);
    saveUnreadStatusCounts(getUnreadStatusCounts(rows));
  };
  const openInvoiceDetails = (invoice) => {
    setSelectedInvoice(invoice);
    markStatusSeen(invoice.status);
  };
  const periodLabel = fromDate && toDate && fromDate.slice(0, 7) === toDate.slice(0, 7)
    ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
      .format(new Date(`${fromDate}T12:00:00`))
    : fromDate || toDate
      ? `${fromDate ? displayDate(fromDate) : 'Any date'} – ${toDate ? displayDate(toDate) : 'Any date'}`
      : 'All dates';
  const selectStatus = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
    if (status !== 'ALL') markStatusSeen(status);
  };
  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-20">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium text-slate-400">Sales <span className="px-1">›</span> Finance</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            {role === 'ar created' ? 'POS Drafts & Waiting Approval' : 'Invoices'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedDraftRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {selectedDraftRows.some((r) => !r.claimed_by_id) && (
                <button
                  type="button"
                  onClick={() => handleClaimDrafts(selectedDraftRows.filter((r) => !r.claimed_by_id).map((r) => r.id))}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
                >
                  <Lock size={13} />
                  Claim Draft ({selectedDraftRows.filter((r) => !r.claimed_by_id).length})
                </button>
              )}
              {selectedDraftRows.some((r) => r.claimed_by_id === currentUser?.id || ['super admin', 'approval'].includes(role)) && (
                <button
                  type="button"
                  onClick={() => handleReleaseDrafts(selectedDraftRows.filter((r) => r.claimed_by_id === currentUser?.id || ['super admin', 'approval'].includes(role)).map((r) => r.id))}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Unlock size={13} />
                  Release Claim ({selectedDraftRows.filter((r) => r.claimed_by_id === currentUser?.id || ['super admin', 'approval'].includes(role)).length})
                </button>
              )}
              <button
                type="button"
                onClick={handleCreateInvoiceFromDrafts}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600"
              >
                <FilePlus2 size={14} />
                Create Invoice ({selectedDraftRows.length})
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {visibleInvoiceCards.map((card) => {
          const Icon = card.icon;
          const isActive = statusFilter === card.value;
          return (
            <button
              key={card.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => selectStatus(card.value)}
              className={`rounded-xl border bg-white p-3 text-left shadow-[0_2px_6px_rgba(15,23,42,0.04)] transition ${
                isActive ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{card.label}</span>
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${card.iconStyle}`}>
                  <Icon size={16} />
                </span>
              </span>
              <span className={`mt-1.5 block text-2xl font-semibold tracking-tight ${card.color}`}>{card.count}</span>
            </button>
          );
        })}
      </section>

      <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-200 px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Invoices</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {periodLabel}<span className="px-1.5">·</span>{filteredRows.length} invoices
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedPrintInvoices.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Printer size={14} />
                  Print Selected ({selectedPrintInvoices.length})
                </button>
              )}
              <button
                type="button"
                onClick={exportToExcel}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Download size={14} />
                Export {filteredRows.length} rows
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2.5">
            <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
              From
              <input
                type="date"
                aria-label="Import date from"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
              To
              <input
                type="date"
                aria-label="Import date to"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-normal text-slate-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </label>
            <InvoiceFilterDropdown
              label="Customer group"
              value={clientFilter}
              options={[
                { value: 'ALL', label: 'All customers' },
                ...clients.map((client) => ({ value: client, label: client })),
              ]}
              onChange={(client) => {
                setClientFilter(client);
                setCurrentPage(1);
              }}
              widthClass="min-w-[150px]"
            />
            <InvoiceFilterDropdown
              label="Status"
              value={statusFilter}
              options={statusOptions}
              onChange={selectStatus}
              widthClass="min-w-[125px]"
            />
            <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500">
              Search
              <span className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="Search invoice, WPP or customer"
                  placeholder="Invoice, WPP, customer..."
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 w-[220px] rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs font-normal text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                />
              </span>
            </label>
            <InvoiceFilterDropdown
              label="Sort by"
              value={currentSortOption}
              options={sortOptions}
              onChange={(option) => {
                const [field, direction] = option.split(':');
                setSortBy(field);
                setSortDirection(direction);
                setCurrentPage(1);
              }}
              widthClass="min-w-[165px]"
            />
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg px-2.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50"
            >
              All dates
            </button>
          </div>

          {(statusFilter === 'Draft' || role === 'ar created') && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 text-xs">
              <span className="mr-1 text-[11px] font-medium text-slate-400">Claim Filter:</span>
              <button
                type="button"
                onClick={() => { setClaimFilter('ALL'); setCurrentPage(1); }}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  claimFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({draftStats.total})
              </button>
              <button
                type="button"
                onClick={() => { setClaimFilter('AVAILABLE'); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  claimFilter === 'AVAILABLE'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Available ({draftStats.available})
              </button>
              <button
                type="button"
                onClick={() => { setClaimFilter('MY_DRAFTS'); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  claimFilter === 'MY_DRAFTS'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <UserCheck size={12} />
                My Drafts ({draftStats.myDrafts})
              </button>
              <button
                type="button"
                onClick={() => { setClaimFilter('OTHER_AR'); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  claimFilter === 'OTHER_AR'
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Lock size={12} />
                Other AR ({draftStats.otherAr})
              </button>
            </div>
          )}
        </div>

        <div className="data-table-scroll">
          <table className="data-table w-full min-w-[1480px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-[13px] text-slate-600">
              <tr>
                <th className="w-10 px-3 py-3.5 text-center font-medium">
                  <input
                    type="checkbox"
                    aria-label="Select all Draft and printable invoices on this page"
                    checked={allActionableSelected}
                    disabled={visiblePrintableRows.length + selectableDrafts.length === 0}
                    onChange={(event) => {
                      setSelectedDraftIds((current) => event.target.checked
                        ? Array.from(new Set([...current, ...selectableDraftIds]))
                        : current.filter((id) => !selectableDraftIds.includes(id)));
                      setSelectedPrintIds((current) => event.target.checked
                        ? Array.from(new Set([...current, ...visiblePrintableIds]))
                        : current.filter((id) => !visiblePrintableIds.includes(id)));
                    }}
                    className="h-4 w-4 rounded border-slate-300 accent-amber-500"
                  />
                </th>
                <th className="px-3 py-3.5 font-medium">Number</th>
                <th className="px-3 py-3.5 font-medium">Status</th>
                <th className="px-3 py-3.5 font-medium">No WPP</th>
                <th className="px-3 py-3.5 font-medium">Customer</th>
                <th className="px-3 py-3.5 font-medium">Store Name</th>
                <th className="px-3 py-3.5 font-medium">Created By</th>
                <th className="px-3 py-3.5 font-medium">Approved By</th>
                <th
                  className="cursor-pointer px-3 py-3.5 font-medium"
                  onClick={() => {
                    setSortBy('import_date');
                    setSortDirection((direction) => direction === 'desc' ? 'asc' : 'desc');
                  }}
                >
                  <span className="inline-flex items-center gap-1">Import Date <ArrowUpDown size={12} /></span>
                </th>
                <th className="px-3 py-3.5 font-medium">Month / Year</th>
                <th className="px-3 py-3.5 font-medium">AR Queue Timestamp</th>
                <th className="px-3 py-3.5 font-medium">Approved Timestamp</th>
                <th className="px-3 py-3.5 text-right font-medium">Total</th>
                <th className="px-3 py-3.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={14} className="px-4 py-12 text-center text-slate-500">Loading invoices…</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={14} className="px-4 py-12 text-center text-slate-500">No invoices match these filters.</td></tr>
              ) : paginatedRows.map((row) => (
                <tr
                  key={`${row.id}-${row.status}`}
                  tabIndex={['Invoiced', 'Approved'].includes(row.status) ? 0 : -1}
                  aria-label={['Invoiced', 'Approved'].includes(row.status) ? `Open ${row.status.toLowerCase()} invoice details` : undefined}
                  onClick={() => {
                    if (['Invoiced', 'Approved'].includes(row.status)) openInvoiceDetails(row);
                  }}
                  onKeyDown={(event) => {
                    if (['Enter', ' '].includes(event.key) && ['Invoiced', 'Approved'].includes(row.status)) {
                      event.preventDefault();
                      openInvoiceDetails(row);
                    }
                  }}
                  className={`transition-colors hover:bg-amber-50/50 ${
                    ['Invoiced', 'Approved'].includes(row.status) ? 'cursor-pointer focus:bg-amber-50 focus:outline-none' : ''
                  }`}
                >
                  <td className="px-3 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                    {row.status === 'Draft' && canSelectDraft ? (
                      <input
                        type="checkbox"
                        aria-label={`Select draft ${row.no_wpp} to create an invoice`}
                        disabled={Boolean(row.claimed_by_id && row.claimed_by_id !== currentUser?.id)}
                        title={
                          row.claimed_by_id && row.claimed_by_id !== currentUser?.id
                            ? `In progress by ${row.claimed_by_name || 'other AR'}`
                            : undefined
                        }
                        checked={selectedDraftIds.includes(row.id)}
                        onChange={(event) => {
                          setSelectedDraftIds((current) => event.target.checked
                            ? [...current, row.id]
                            : current.filter((id) => id !== row.id)
                          );
                        }}
                        className={`h-4 w-4 rounded border-slate-300 accent-amber-500 ${
                          row.claimed_by_id && row.claimed_by_id !== currentUser?.id
                            ? 'cursor-not-allowed opacity-30'
                            : 'cursor-pointer'
                        }`}
                      />
                    ) : ['Invoiced', 'Approved'].includes(row.status) && (
                      <input
                        type="checkbox"
                        aria-label={`Select invoice ${row.invoice_no || row.no_wpp} for printing`}
                        checked={selectedPrintIds.includes(row.id)}
                        onChange={(event) => {
                          setSelectedPrintIds((current) => event.target.checked
                            ? [...current, row.id]
                            : current.filter((id) => id !== row.id)
                          );
                        }}
                        className="h-4 w-4 rounded border-slate-300 accent-amber-500"
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono font-medium text-slate-800">{row.invoice_no || '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${
                      row.status === 'Approved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : row.status === 'Invoiced'
                          ? 'bg-amber-100 text-amber-800'
                          : row.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-orange-50 text-orange-800'
                    }`}>
                      {row.status === 'Invoiced' ? 'Waiting Approval' : row.status}
                    </span>
                    {row.status === 'Draft' && (
                      <div className="mt-1">
                        {row.claimed_by_id === currentUser?.id ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200" title="Draft claimed by you">
                            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white">
                              <Check size={10} strokeWidth={3} />
                            </span>
                            My Draft
                          </span>
                        ) : row.claimed_by_id ? (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600" title={`In progress by ${row.claimed_by_name || 'Other AR'}`}>
                            <Lock size={10} className="text-slate-400" />
                            {row.claimed_by_name || 'Other AR'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            Available
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="w-44 min-w-44 px-3 py-3 font-mono text-slate-700">
                    <span className="flex flex-col gap-y-0.5 leading-5">
                      {(row.transaction_lines.length ? row.transaction_lines : [{ no_wpp: '—' }]).map((line, index) => (
                        <span key={`${line.no_wpp}-${index}`} className="whitespace-nowrap">{line.no_wpp}</span>
                      ))}
                    </span>
                  </td>
                  <td className="max-w-52 truncate px-3 py-3 text-slate-700">{row.client_name}</td>
                  <td className="max-w-56 px-3 py-3 text-slate-700" title={row.store_name}>
                    <span className="flex flex-col gap-y-0.5 leading-5">
                      {(row.transaction_lines.length ? row.transaction_lines : [{ store_name: row.store_name || '—' }]).map((line, index) => (
                        <span key={`${line.no_wpp || 'store'}-${index}`} className="truncate">{line.store_name || '—'}</span>
                      ))}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{row.created_by || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{row.approved_by || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{displayDate(row.import_date)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{row.month_year || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{displayDate(row.created_invoice_at, true)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{displayDate(row.approved_at, true)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-medium text-slate-800">
                    {row.status === 'Draft' ? (
                      <label className="inline-flex items-center justify-end gap-1.5">
                        <Pencil size={12} className="text-slate-400" />
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Edit grand total for ${row.no_wpp}`}
                          value={editingDraftTotals[row.id] ?? row.grand_total}
                          onChange={(event) => setEditingDraftTotals((current) => ({ ...current, [row.id]: event.target.value }))}
                          onBlur={(event) => {
                            if (editingDraftTotals[row.id] === undefined) return;
                            const value = event.target.value;
                            setEditingDraftTotals((current) => {
                              const next = { ...current };
                              delete next[row.id];
                              return next;
                            });
                            handleDraftGrandTotalChange(row.id, value);
                          }}
                          className="w-32 rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                        />
                      </label>
                    ) : formatRupiah(row.grand_total)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {canApprove && row.status === 'Invoiced' && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleApprove(row);
                        }}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                    )}
                    {row.status === 'Draft' && canSelectDraft && (
                      <div className="inline-flex items-center justify-end gap-1">
                        {!row.claimed_by_id ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleClaimDrafts([row.id]);
                            }}
                            className="group inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-emerald-500 bg-emerald-50 text-emerald-600 shadow-xs transition hover:bg-emerald-600 hover:text-white"
                            title="Claim draft"
                            aria-label="Claim draft"
                          >
                            <Check size={14} strokeWidth={2.5} />
                          </button>
                        ) : row.claimed_by_id === currentUser?.id || ['super admin', 'approval'].includes(role) ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleReleaseDrafts([row.id]);
                            }}
                            className="group inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs transition hover:bg-rose-600"
                            title="Claimed - Click to release"
                            aria-label="Claimed - Click to release"
                          >
                            <Check size={15} strokeWidth={3} className="transition group-hover:hidden" />
                            <X size={15} strokeWidth={3} className="hidden transition group-hover:block" />
                          </button>
                        ) : (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400" title={`Claimed by ${row.claimed_by_name || 'Other AR'}`}>
                            <Lock size={13} />
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          currentPage={visiblePage}
          pageSize={pageSize}
          totalItems={filteredRows.length}
          onPageChange={(page) => setCurrentPage(Math.min(page, totalPages))}
        />
      </section>

      {selectedInvoice && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedInvoice(null);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-detail-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-[620px] animate-[drawer-in_240ms_cubic-bezier(0.2,0.8,0.2,1)] flex-col border-l border-slate-200 bg-white shadow-2xl"
          >
            <header className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-400">{selectedInvoice.invoice_no || 'Invoice details'}</p>
                  <h2 id="invoice-detail-title" className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-950">
                    {selectedInvoice.client_name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {String(selectedInvoice.no_wpp || '').split(/\s*,\s*/).filter(Boolean).length} POS transaction(s)
                    <span className="px-1">·</span> Imported {displayDate(selectedInvoice.import_date)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close invoice details"
                  onClick={() => setSelectedInvoice(null)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  selectedInvoice.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {selectedInvoice.status}
                </span>
                <span className="text-xs text-slate-400">
                  {selectedInvoice.status === 'Approved' ? 'Approved' : 'In AR queue'}
                </span>
              </div>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <section className="rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Invoice total</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {formatRupiah(selectedInvoice.grand_total)}
                </p>
              </section>
              <section className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">No WPP</p>
                  <div className="mt-1 flex flex-col gap-y-1 font-mono text-sm text-slate-800">
                    {(selectedInvoice.transaction_lines.length
                      ? selectedInvoice.transaction_lines
                      : String(selectedInvoice.no_wpp || '—').split(/\s*,\s*/).filter(Boolean).map((number, index) => ({ no_wpp: number, id: index }))
                    ).map((line, index) => (
                      <span key={`${line.no_wpp}-${index}`}>{line.no_wpp}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Store Name</p>
                  <div className="mt-1 flex flex-col gap-y-1 text-sm text-slate-800">
                    {(selectedInvoice.transaction_lines.length
                      ? selectedInvoice.transaction_lines
                      : [{ store_name: selectedInvoice.store_name || '—' }]
                    ).map((line, index) => (
                      <span key={`${line.store_name || 'store'}-${index}`} className="break-words">{line.store_name || '—'}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Month / Year</p>
                  <p className="mt-1 text-sm text-slate-800">{selectedInvoice.month_year || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">AR queue timestamp</p>
                  <p className="mt-1 text-sm text-slate-800">{displayDate(selectedInvoice.created_invoice_at, true)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Approved timestamp</p>
                  <p className="mt-1 text-sm text-slate-800">{displayDate(selectedInvoice.approved_at, true)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Created by</p>
                  <p className="mt-1 text-sm text-slate-800">{selectedInvoice.created_by || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Approved by</p>
                  <p className="mt-1 text-sm text-slate-800">{selectedInvoice.approved_by || '—'}</p>
                </div>
              </section>
              {selectedInvoice.items?.length > 0 && (
                <section className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-800">Invoice items</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selectedInvoice.items.map((item, index) => (
                      <div key={item.id || `${item.source_no_wpp || item.wpp_number}-${index}`} className="flex items-start justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {item.store_name || item.item_description || item.client_name || `Item ${index + 1}`}
                          </p>
                          <p className="mt-1 font-mono text-xs text-slate-500">
                            {item.source_no_wpp || item.wpp_number || item.no_faktur || '—'}
                          </p>
                        </div>
                        <p className="whitespace-nowrap text-sm font-medium text-slate-800">
                          {formatRupiah(Number(item.total_price || item.total_faktur || item.nilai_wpp || 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
            {canApprove && selectedInvoice.status === 'Invoiced' && (
              <footer className="border-t border-slate-200 p-5">
                <button
                  type="button"
                  onClick={() => handleApprove(selectedInvoice)}
                  className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
                >
                  Approve invoice
                </button>
              </footer>
            )}
          </aside>
          <style jsx>{`
            @keyframes drawer-in {
              from { opacity: 0; transform: translateX(24px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>
        </div>
      )}
      <PrintModal
        invoices={selectedPrintInvoices}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        onPrintConfirmed={(ids) => {
          const printedIds = new Set(ids);
          Promise.all([...printedIds].map((id) => markInvoiceWorkflowPrinted(id)))
            .then(() => window.dispatchEvent(new Event('wellen-invoice-workflows')))
            .catch((error) => {
              console.error('Failed to save invoice print timestamps:', error);
              setFeedback({
                variant: 'error',
                title: 'Print status could not be saved',
                description: 'The invoice may have printed, but its print history was not recorded.',
              });
            });
        }}
      />
      <FeedbackDialog
        open={Boolean(feedback)}
        variant={feedback?.variant}
        title={feedback?.title}
        description={feedback?.description}
        confirmLabel={feedback?.confirmLabel}
        onConfirm={confirmApproval}
        onClose={() => {
          setFeedback(null);
          setPendingApproval(null);
        }}
      />
    </div>
  );
}
