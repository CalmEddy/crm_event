// Read-only contact details block with mailto/tel/website links.
type Details = {
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

const link = "text-[color:var(--accent)] hover:underline";
const tel = (value: string) => `tel:${value.replace(/[^\d+]/g, "")}`;

export function ContactDetails({ details }: { details: Details }) {
  const cityLine = [details.city, [details.region, details.postalCode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const address = [details.address, cityLine, details.country].filter(Boolean) as string[];
  const rows: [string, React.ReactNode][] = [];
  if (details.email) {
    rows.push(["Email", <a key="v" className={link} href={`mailto:${details.email}`}>{details.email}</a>]);
  }
  if (details.phone) rows.push(["Phone", <a key="v" className={link} href={tel(details.phone)}>{details.phone}</a>]);
  if (details.mobile) rows.push(["Mobile", <a key="v" className={link} href={tel(details.mobile)}>{details.mobile}</a>]);
  if (details.website) {
    rows.push([
      "Website",
      <a key="v" className={link} href={details.website} target="_blank" rel="noopener noreferrer">
        {details.website.replace(/^https?:\/\//, "")}
      </a>,
    ]);
  }
  if (address.length) {
    rows.push([
      "Address",
      <address key="v" className="not-italic">
        {address.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>,
    ]);
  }
  if (rows.length === 0) return <p className="text-[color:var(--muted)]">No contact details yet.</p>;
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[7rem_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-[color:var(--muted)]">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
