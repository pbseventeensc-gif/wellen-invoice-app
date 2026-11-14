'use client';

import { Children, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

export default function SearchableSelect({
  children, options: suppliedOptions, value, onChange, onValueChange, id, name,
  disabled = false, className = '', placeholder = 'Select an option…',
  searchPlaceholder = 'Search…', footer, ...props
}) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const listId = `${controlId}-options`;
  const trigger = useRef(null);
  const panel = useRef(null);
  const search = useRef(null);
  const [position, setPosition] = useState(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const options = suppliedOptions || Children.toArray(children).filter(Boolean).map((child) => ({
    value: child.props.value, label: child.props.children, disabled: child.props.disabled,
  }));
  const selected = options.find((option) => String(option.value) === String(value));
  const filtered = options.filter((option) => `${option.label} ${option.description || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const enabled = filtered.filter((option) => !option.disabled);
  const activeOption = enabled[Math.min(active, enabled.length - 1)];
  const label = props['aria-label'] || name || 'Select an option';
  const close = (restoreFocus = false) => {
    setPosition(null);
    if (restoreFocus) trigger.current?.focus();
  };
  const locate = () => {
    const rect = trigger.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const upward = below < 240 && above > below;
    const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 24);
    return {
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width,
      ...(upward ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
      maxHeight: Math.max(100, Math.min(360, upward ? above : below)),
    };
  };
  const open = () => {
    if (disabled) return;
    setQuery(''); setActive(0); setPosition(locate());
  };
  const choose = (option) => {
    if (!option || option.disabled) return;
    onValueChange?.(option.value);
    onChange?.({ target: { value: String(option.value), name, id: controlId } });
    close(true);
  };

  useEffect(() => {
    if (!position) return;
    search.current?.focus();
    const outside = (event) => {
      if (!trigger.current?.contains(event.target) && !panel.current?.contains(event.target)) setPosition(null);
    };
    const move = (event) => {
      if (event.type === 'resize' || !panel.current?.contains(event.target)) setPosition(null);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    window.addEventListener('resize', move);
    window.addEventListener('scroll', move, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      window.removeEventListener('resize', move);
      window.removeEventListener('scroll', move, true);
    };
  }, [position]);

  const keyboard = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    if (event.target !== search.current && event.target !== trigger.current) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!position) { open(); return; }
      const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % (enabled.length || 1);
      setActive(next);
      panel.current?.querySelector(`[data-option-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
    }
    if (position && event.key === 'Enter') { event.preventDefault(); choose(activeOption); }
  };

  return <div className={`inline-block min-w-0 max-w-full ${className}`}>
    <button ref={trigger} id={controlId} type="button" disabled={disabled}
      aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']}
      aria-haspopup="listbox" aria-expanded={Boolean(position)} aria-controls={position ? listId : undefined}
      onKeyDown={keyboard} onClick={() => position ? close() : open()}
      className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 text-left text-xs font-normal text-slate-800 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 ${position ? 'border-orange-400 ring-4 ring-orange-100' : 'border-slate-200 hover:border-slate-300 focus-visible:border-orange-400 focus-visible:ring-4 focus-visible:ring-orange-100'}`}>
      <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
      <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${position ? 'rotate-180' : ''}`} />
    </button>
    {name && <input type="hidden" name={name} value={value ?? ''} disabled={disabled} />}
    {position && !disabled && createPortal(
      <div ref={panel} style={position} onKeyDown={keyboard} className="fixed z-[200] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_48px_rgba(15,23,42,0.12)]">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input ref={search} role="combobox" aria-label={`Search ${label}`} aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
            aria-activedescendant={activeOption ? `${listId}-${filtered.indexOf(activeOption)}` : undefined}
            value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} placeholder={searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
        </div>
        <div id={listId} role="listbox" aria-label={label} className="min-h-0 overflow-y-auto overscroll-contain px-3">
          {filtered.length ? filtered.map((option, index) => {
            const checked = String(option.value) === String(value);
            return <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={checked} aria-disabled={Boolean(option.disabled)}
              data-option-index={enabled.indexOf(option)} onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              className={`flex cursor-pointer items-start gap-3 border-b border-slate-100 px-1 py-3 text-sm last:border-0 ${option.disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-orange-50'} ${option === activeOption ? 'bg-slate-50' : ''}`}>
              <span aria-hidden="true" className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${checked ? 'border-orange-400' : 'border-slate-300'}`}>{checked && <span className="h-2 w-2 rounded-full bg-orange-400" />}</span>
              <span className="min-w-0 break-words text-slate-800">{option.label}{option.description && <span className="mt-1 block text-xs leading-5 text-slate-500">{option.description}</span>}</span>
            </div>;
          }) : <p className="px-1 py-4 text-xs text-slate-500">No matching options.</p>}
        </div>
        {footer && <div className="shrink-0 border-t border-slate-100">{footer({ query, close: () => setPosition(null) })}</div>}
      </div>, document.body)}
  </div>;
}
