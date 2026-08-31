export default function Loading() {
  return (
    <main className="loading-shell" aria-label="Loading portfolio command center">
      <div className="loading-sidebar" />
      <div className="loading-content">
        <div className="skeleton skeleton-title" />
        <div className="skeleton-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="skeleton skeleton-card" key={index} />
          ))}
        </div>
        <div className="skeleton skeleton-chart" />
      </div>
    </main>
  );
}
