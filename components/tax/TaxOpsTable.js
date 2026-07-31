"use client";

export default function TaxOpsTable({ columns, rows, emptyLabel = "No records yet.", loading }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-default)]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-[var(--text-secondary)]"
              >
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-[var(--text-secondary)]"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border-default)]">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-2 align-top">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
