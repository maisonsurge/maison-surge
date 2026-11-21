"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fbfaf7", color: "#1a1a1a", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 500 }}>Bir şeyler ters gitti / Something went wrong</h1>
          {error.digest ? <p style={{ fontSize: 12, color: "#5f5b53" }}>Ref: {error.digest}</p> : null}
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 18px", background: "#1a1a1a", color: "#fbfaf7", border: 0, cursor: "pointer" }}>
            Tekrar dene / Try again
          </button>
        </div>
      </body>
    </html>
  );
}
