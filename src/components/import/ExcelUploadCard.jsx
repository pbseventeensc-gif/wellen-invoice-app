'use client';

import { useId, useRef, useState } from 'react';
import { Check, FileSpreadsheet, LoaderCircle, UploadCloud } from 'lucide-react';

export default function ExcelUploadCard({ fileName, rowCount, isReading, disabled, onFileSelect }) {
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const headingId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const isReady = Boolean(fileName && rowCount > 0 && !isReading);
  const state = isReading ? 'reading' : isDragging ? 'dragging' : isReady ? 'ready' : 'idle';

  const handleDrop = (event) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !disabled && !isReading) onFileSelect(file);
  };

  return (
    <div className="excel-upload-panel" data-state={state}>
    <section
      className="excel-upload-card"
      data-state={state}
      aria-labelledby={headingId}
      aria-busy={isReading}
      onDragEnter={(event) => {
        event.preventDefault();
        if (disabled || isReading || !Array.from(event.dataTransfer.types).includes('Files')) return;
        dragDepth.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled || isReading ? 'none' : 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        tabIndex={-1}
        accept=".xlsx,.xls"
        aria-label="Select an Excel recap file"
        disabled={disabled || isReading}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFileSelect(file);
        }}
      />
      <div className="excel-upload-art" aria-hidden="true">
        <UploadCloud className="excel-upload-cloud" size={36} strokeWidth={1.4} />
        <span className="excel-upload-indicator" key={state}>
          {isReading ? <LoaderCircle size={14} className="animate-spin" /> : isReady ? <Check size={14} /> : <FileSpreadsheet size={13} />}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h2 id={headingId} className="text-sm font-medium leading-5 text-slate-800">
          {isReading ? 'Reading your Excel file' : isDragging ? 'Drop your Excel file here' : isReady ? 'Excel file ready' : 'Import an Excel recap'}
        </h2>
        <p className="mt-1 truncate text-xs leading-5 text-slate-500" title={fileName || undefined} aria-live="polite">
          {isReading ? 'Preparing your data for review…' : isReady ? `${rowCount} rows prepared for review.` : 'Drag and drop your .xlsx or .xls file here.'}
        </p>
        <button
          type="button"
          disabled={disabled || isReading}
          onClick={() => inputRef.current?.click()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50"
        >
          {isReading ? 'Reading file…' : isReady ? 'Choose another file' : 'Select Excel File'}
        </button>
      </div>
    </section>
    {(isReading || isReady) && (
      <div className="excel-upload-file" role="status">
        <FileSpreadsheet size={20} strokeWidth={1.5} className="shrink-0 text-emerald-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="truncate text-xs text-slate-700" title={fileName}>{fileName}</span>
            <span className="shrink-0 text-[10px] text-slate-500">{isReading ? 'Reading…' : 'Ready to review'}</span>
          </div>
          <div className="excel-upload-progress" aria-hidden="true"><span /></div>
        </div>
      </div>
    )}
    </div>
  );
}
