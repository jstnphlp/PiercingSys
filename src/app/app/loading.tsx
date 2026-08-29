export default function Loading() {
  return (
    <div className="staff-shell" aria-busy="true" aria-label="Loading workspace">
      <aside className="staff-sidebar" />
      <main className="staff-main">
        <header className="staff-topbar">
          <div>
            <p className="eyebrow">PIERCING CORNER · STUDIO DESK</p>
            <h1>Loading workspace…</h1>
          </div>
        </header>
        <div className="staff-content">
          <div className="dashboard-content">
            <section className="panel route-loading" role="status">
              Loading live studio data…
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
