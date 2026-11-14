// One print stylesheet for preview and browser printing. Page margins belong to
// @page; sheets fill that printable area rather than adding another A4 box.
export const invoicePrintStyles = `
  @page { size: A4 portrait; margin: 12mm 14mm 9mm; }
  html, body {
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    color: #000 !important;
    overflow: visible !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body > *:not(.print-modal-root) { display: none !important; }
  .print-modal-root, .print-modal-card, #print-area {
    position: static !important;
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    background: #fff !important;
    box-shadow: none !important;
    overflow: visible !important;
    transform: none !important;
    filter: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
  .print-actions { display: none !important; }
  .print-sheet {
    position: relative;
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
    break-inside: auto;
    page-break-inside: auto;
  }
  .print-sheet:not(:last-child) { break-after: page; page-break-after: always; }
  .print-sheet:last-child { break-after: auto; page-break-after: auto; }
  .print-sheet.print-single-item {
    display: block !important;
    /* Leave room for Safari's native print headers, footers and margins. */
    min-height: 240mm !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    padding-top: 5mm !important;
  }
  .print-sheet .invoice-print-footer {
    margin-top: 8mm !important;
    padding-top: 0 !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }
  .print-sheet.print-single-item .invoice-print-footer {
    display: block !important;
    margin-top: 11mm !important;
  }
  .print-sheet.print-internal-hidden .invoice-print-footer {
    margin-top: 6mm !important;
  }
  .print-sheet.print-single-item .invoice-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
  }
  .print-sheet.print-single-item .invoice-payment {
    margin-top: 0 !important;
    padding-top: 0 !important;
  }
  .print-sheet table { width: 100%; border-collapse: collapse; }
  .print-sheet .invoice-line-table { table-layout: fixed; }
  .print-sheet thead { display: table-header-group; }
  .print-sheet.print-single-item thead { display: table-row-group; }
  .print-sheet th { vertical-align: top; }
  .print-sheet tr, .invoice-summary, .invoice-payment, .invoice-notes, .invoice-internal-breakdown {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .print-sheet p, .print-sheet td, .print-sheet th {
    overflow-wrap: anywhere;
  }
  .print-sheet .invoice-notes p { white-space: normal !important; }
`;
