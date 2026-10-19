export interface ReportUpdate {
  id: string;
  posted_at: string;
  author: string;
  status: string;
  body: string;
  current_capacity: string | null;
  project_requirement: string | null;
  internal_notes: string | null;
  action_items: string | null;
  comments: { author: string; body: string; created_at: string }[];
}

export interface ProjectUpdatesReport {
  generated_at: string;
  timezone: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  update_count: number;
  projects: { id: string; name: string; status: string; updates: ReportUpdate[] }[];
}

export function reportDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(value));
}

export const reportPrintStyles = `
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #142036; background: white; }
  h1 { font-size: 22pt; margin: 0 0 8px; } h2 { font-size: 15pt; margin: 24px 0 8px; }
  h3 { font-size: 11pt; margin: 10px 0 5px; } p { margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; }
  th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; vertical-align: top; overflow-wrap: anywhere; white-space: pre-wrap; }
  th { background: #edf2f7; } thead { display: table-header-group; }
  .report-section { margin-bottom: 24px; } .report-meta { color: #475569; margin-bottom: 16px; }
  .report-comment { border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 4px; }
  .report-project-heading { break-after: avoid; }
`;
