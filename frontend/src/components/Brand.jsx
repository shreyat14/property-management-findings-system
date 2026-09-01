export function Brand({ compact = false }) {
  return (
    <div className="brand" aria-label="Property Inspection Findings">
      <span className="brand-mark" aria-hidden="true">PI</span>
      {!compact && <span>Property Findings</span>}
    </div>
  )
}
