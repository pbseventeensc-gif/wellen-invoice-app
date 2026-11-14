export default function PageHeading({ title, badge }) {
  const breadcrumb = ['Sales', 'Finance'];
  return <div className="min-w-0">
    <nav aria-label="Breadcrumb" className="text-xs font-medium text-slate-400">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {breadcrumb.map((label, index) => <li key={label} className="inline-flex items-center gap-2">
          {index > 0 && <span aria-hidden="true">›</span>}
          <span>{label}</span>
        </li>)}
      </ol>
    </nav>
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="text-2xl font-medium tracking-tight text-slate-950">{title}</h1>
      {badge}
    </div>
  </div>;
}
