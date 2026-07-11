import { AlertTriangle, Inbox, Loader2, ShieldX } from 'lucide-react';
import type { ReactNode } from 'react';

export function PortalLoading({ label }: { label: string }) {
  return <div className="pms-loading" role="status"><Loader2 size={22} aria-hidden="true" />{label}</div>;
}
export function PortalError({ message }: { message: string }) {
  return <section className="pms-empty-card" role="alert"><AlertTriangle size={24} aria-hidden="true" /><div><h2>Unable to load this workspace</h2><p>{message}</p></div></section>;
}
export function PortalNoAccess({ message }: { message: string }) {
  return <section className="pms-empty-card" role="alert"><ShieldX size={24} aria-hidden="true" /><div><h2>Access not available</h2><p>{message}</p></div></section>;
}
export function PortalEmpty({ title, message }: { title: string; message: string }) {
  return <section className="pms-empty-card"><Inbox size={24} aria-hidden="true" /><div><h2>{title}</h2><p>{message}</p></div></section>;
}
export function PortalPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="pms-form-card"><h2>{title}</h2>{children}</section>;
}
