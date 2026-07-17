import { Bookmark, Eye, Save, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

type Column = { id: string; label: string };
type SavedView = { id: string; name: string; query: string };

type Props = {
  columns?: Column[];
  columnParam?: string;
  language: 'en' | 'ar';
  namespace: string;
  searchParams: URLSearchParams;
  setSearchParams: (nextInit: URLSearchParams, navigateOptions?: { replace?: boolean }) => void;
};

function readViews(key: string): SavedView[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is SavedView => Boolean(item && typeof item === 'object' && 'id' in item && 'name' in item && 'query' in item))
      : [];
  } catch {
    return [];
  }
}

export default function SavedViewControls({ columns = [], columnParam = 'columns', language, namespace, searchParams, setSearchParams }: Props) {
  const storageKey = `lux.om:saved-views:${namespace}`;
  const [views, setViews] = useState<SavedView[]>(() => readViews(storageKey));
  const [name, setName] = useState('');
  const hiddenValue = searchParams.get(columnParam) ?? '';
  const [hidden, setHidden] = useState(() => new Set(hiddenValue.split(',').filter(Boolean)));
  const text = language === 'ar'
    ? { label: 'العروض المحفوظة', name: 'اسم العرض', save: 'حفظ العرض الحالي', choose: 'اختر عرضاً محفوظاً', apply: 'تطبيق', remove: 'حذف', columns: 'الأعمدة الظاهرة' }
    : { label: 'Saved views', name: 'View name', save: 'Save current view', choose: 'Choose a saved view', apply: 'Apply', remove: 'Delete', columns: 'Visible columns' };

  useEffect(() => setViews(readViews(storageKey)), [storageKey]);
  useEffect(() => setHidden(new Set(hiddenValue.split(',').filter(Boolean))), [hiddenValue]);

  function persist(next: SavedView[]) {
    setViews(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = views.find((view) => view.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    const item = { id: existing?.id ?? crypto.randomUUID(), name: trimmed, query: new URLSearchParams(window.location.search).toString() };
    persist(existing ? views.map((view) => view.id === existing.id ? item : view) : [...views, item]);
    setName('');
  }

  function apply(id: string) {
    const view = views.find((item) => item.id === id);
    if (view) setSearchParams(new URLSearchParams(view.query));
  }

  function toggleColumn(id: string, visible: boolean) {
    const nextHidden = new Set(hidden);
    if (visible) nextHidden.delete(id); else nextHidden.add(id);
    setHidden(nextHidden);
    const next = new URLSearchParams(searchParams);
    if (nextHidden.size) next.set(columnParam, [...nextHidden].sort().join(',')); else next.delete(columnParam);
    setSearchParams(next, { replace: true });
  }

  return <section className="saved-view-controls" aria-label={text.label}>
    <form onSubmit={save}>
      <label><span>{text.name}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <button className="button-link button-link--secondary" disabled={!name.trim()} type="submit"><Save aria-hidden="true" size={16} />{text.save}</button>
    </form>
    {views.length ? <div className="saved-view-controls__saved"><Bookmark aria-hidden="true" size={17} /><label><span>{text.choose}</span><select defaultValue="" onChange={(event) => apply(event.target.value)}><option value="">{text.choose}</option>{views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select></label>{views.map((view) => <button aria-label={`${text.remove}: ${view.name}`} key={view.id} type="button" onClick={() => persist(views.filter((item) => item.id !== view.id))}><Trash2 aria-hidden="true" size={15} /></button>)}</div> : null}
    {columns.length ? <fieldset><legend><Eye aria-hidden="true" size={16} />{text.columns}</legend>{columns.map((column) => <label key={column.id}><input checked={!hidden.has(column.id)} type="checkbox" onChange={(event) => toggleColumn(column.id, event.target.checked)} /><span>{column.label}</span></label>)}</fieldset> : null}
  </section>;
}
