export function PageSection({ title, blurb, actions, children }) {
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>{title}</h1>
          {blurb ? <p className="muted">{blurb}</p> : null}
        </div>
        {actions ? <div className="no-print">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
