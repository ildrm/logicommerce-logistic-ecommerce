'use client';

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="shop-state">
      <h1>Something went wrong.</h1>
      <p>The page could not be loaded. You can retry without losing your session.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
