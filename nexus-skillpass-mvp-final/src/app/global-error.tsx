'use client';

// Last-resort boundary (renders outside the root layout, so no i18n provider is available).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0, background: '#f7f7f5' }}>
        <main style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>Algo salió mal · Something went wrong</h1>
          <p style={{ color: '#5c5c67' }}>Intenta de nuevo · Please try again.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: '10px 18px', borderRadius: 12, border: 0, background: '#08080a', color: '#fff', fontWeight: 600 }}>
            Reintentar · Retry
          </button>
        </main>
      </body>
    </html>
  );
}
