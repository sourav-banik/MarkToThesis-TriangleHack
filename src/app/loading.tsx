export default function Loading() {
  return (
    <div className="page-container" role="status" aria-live="polite">
      <span className="sr-only">Loading workspace…</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text" />
      <div className="claim-grid">
        {[0, 1, 2, 3].map((key) => (
          <div className="skeleton skeleton-card" key={key} />
        ))}
      </div>
    </div>
  );
}
