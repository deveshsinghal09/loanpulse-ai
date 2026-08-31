export default function LoanLoading() {
  return (
    <div className="loading-shell">
      <div className="loading-sidebar" />
      <main className="loading-content">
        <div className="skeleton skeleton-title" />
        <div className="skeleton-grid twin-loading-grid">
          {Array.from({ length: 5 }).map((_, index) => <div className="skeleton skeleton-card" key={index} />)}
        </div>
        <div className="skeleton skeleton-chart" />
      </main>
    </div>
  );
}
