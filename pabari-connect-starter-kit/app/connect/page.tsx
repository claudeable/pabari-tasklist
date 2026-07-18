'use client';

import { useEffect, useMemo, useState } from 'react';

// Same visual language as the standalone pabari-contacts.html directory:
// ink-navy background, brass accent, Fraunces/IBM Plex type. Ported to
// Tailwind arbitrary values so it drops into the existing app shell without
// needing new design tokens wired into tailwind.config.

type Contact = {
  id: number;
  full_name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  address: string | null;
  company_id: number | null;
  company_name: string | null;
  categories: string[] | null;
  needs_review: boolean;
  duplicate_group: string | null;
};

const CATEGORIES = ['All', 'Banking', 'Government', 'Logistics', 'Legal', 'Healthcare', 'Other'];

export default function ConnectPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [callTarget, setCallTarget] = useState<Contact | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (category !== 'All') params.set('category', category);

      fetch(`/api/connect/contacts?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => setContacts(data.contacts || []))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [query, category]);

  const showHint = !query.trim() && category === 'All';

  return (
    <div className="min-h-screen bg-[#12151c] text-[#e9e6de]">
      <header className="sticky top-0 z-20 bg-gradient-to-b from-[#12151c] to-transparent px-5 pt-4 backdrop-blur">
        <div className="flex items-baseline justify-between pb-1">
          <h1 className="font-serif text-2xl font-semibold text-[#f2ead9]">Pabari Connect</h1>
          <span className="font-mono text-[11px] text-[#8b93a3]">
            {contacts.length.toLocaleString()} shown
          </span>
        </div>

        <div className="relative my-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, country…"
            className="w-full rounded-xl border border-[#2b3242] bg-[#1b202b] px-4 py-3 text-base text-[#e9e6de] outline-none placeholder:text-[#5c6272] focus:border-[#8a6830]"
          />
        </div>

        <div className="flex gap-0.5 overflow-x-auto border-b border-[#2b3242] pb-0 [scrollbar-width:none]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`relative top-px shrink-0 whitespace-nowrap rounded-t-lg border border-b-0 px-3.5 py-2.5 font-mono text-xs tracking-wide transition-colors ${
                category === cat
                  ? 'border-[#e6bd72] bg-[#e6bd72] font-semibold text-[#12151c]'
                  : 'border-[#2b3242] bg-[#1b202b] text-[#8b93a3]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 pb-10 pt-3.5">
        {showHint && contacts.length === 0 && !loading ? (
          <div className="px-5 py-16 text-center text-sm leading-relaxed text-[#5c6272]">
            Start typing a name, company, or country —<br />
            or pick a category above.
          </div>
        ) : null}

        {contacts.map((c) => (
          <ContactCard
            key={c.id}
            contact={c}
            expanded={expandedId === c.id}
            onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
            onCallRequest={() => setCallTarget(c)}
          />
        ))}
      </main>

      {callTarget && (
        <CallConfirmModal
          contact={callTarget}
          onCancel={() => setCallTarget(null)}
          onConfirm={() => {
            window.location.href = `tel:${callTarget.phone}`;
            setCallTarget(null);
          }}
        />
      )}
    </div>
  );
}

function ContactCard({
  contact,
  expanded,
  onToggle,
  onCallRequest,
}: {
  contact: Contact;
  expanded: boolean;
  onToggle: () => void;
  onCallRequest: () => void;
}) {
  const c = contact;
  return (
    <div
      onClick={onToggle}
      className="relative mb-2.5 cursor-pointer overflow-hidden rounded-2xl border border-[#2b3242] bg-[#1b202b] py-3.5 pl-[18px] pr-3.5"
    >
      <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#c4923f]" />
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <div className="font-serif text-base font-semibold text-[#f2ead9]">{c.full_name}</div>
          <div className="mt-0.5 text-[13px] text-[#8b93a3]">
            {c.company_name}
            {c.position ? <span className="text-[#b7bdc9]"> · {c.position}</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.country && (
              <span className="rounded-full border border-[#2b3242] px-1.5 py-0.5 font-mono text-[10.5px] text-[#8b93a3]">
                {c.country}
              </span>
            )}
            {(c.categories || []).map((cat) => (
              <span
                key={cat}
                className="rounded-full border border-[#2b3242] px-1.5 py-0.5 font-mono text-[10.5px] text-[#8b93a3]"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            aria-label="Call"
            disabled={!c.phone}
            onClick={(e) => {
              e.stopPropagation();
              onCallRequest();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2b3242] bg-[#232a37] text-[#e6bd72] disabled:opacity-25"
          >
            ☎
          </button>
          <a
            aria-label="Email"
            href={c.email ? `mailto:${c.email}` : undefined}
            onClick={(e) => e.stopPropagation()}
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-[#2b3242] bg-[#232a37] text-[#8fb3d6] ${
              !c.email ? 'pointer-events-none opacity-25' : ''
            }`}
          >
            ✉
          </a>
        </div>
      </div>

      {expanded && (
        <div className="mt-2.5 border-t border-dashed border-[#2b3242] pt-2.5 text-[12.5px] text-[#8b93a3]">
          {c.phone && <DetailRow label="phone" value={c.phone} />}
          {c.email && <DetailRow label="email" value={c.email} />}
          {c.address && <DetailRow label="address" value={c.address} />}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1 flex gap-2">
      <span className="w-16 shrink-0 font-mono text-[10.5px] uppercase tracking-wide text-[#5c6272]">
        {label}
      </span>
      <span className="break-words text-[#c7cbd3]">{value}</span>
    </div>
  );
}

function CallConfirmModal({
  contact,
  onCancel,
  onConfirm,
}: {
  contact: Contact;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-[420px] rounded-t-2xl border border-b-0 border-[#2b3242] bg-[#1b202b] p-5 pb-8">
        <div className="text-center font-mono text-[11px] uppercase tracking-wider text-[#5c6272]">
          Call
        </div>
        <div className="mt-1.5 text-center font-serif text-xl font-semibold text-[#f2ead9]">
          {contact.full_name}
        </div>
        <div className="mt-1 text-center font-mono text-[15px] text-[#e6bd72]">
          {contact.phone}
        </div>
        <div className="mt-5 flex gap-2.5">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-[#2b3242] bg-[#232a37] py-3.5 font-semibold text-[#8b93a3]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl border border-[#e6bd72] bg-[#e6bd72] py-3.5 font-semibold text-[#12151c]"
          >
            Call
          </button>
        </div>
      </div>
    </div>
  );
}
