export default function MantlePage() {
  return (
    <div className="max-w-[900px] mx-auto px-4 py-10 space-y-4">
      <div className="border border-border bg-bg-panel rounded p-5">
        <p className="text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Parallel Submission</p>
        <h1 className="text-xl font-display font-semibold text-text-primary mb-3">Mantle integration</h1>
        <p className="text-sm text-text-secondary leading-6">
          The Mantle Turing Test Hackathon work is preserved in the root <span className="font-mono">mantle/</span> folder.
          This Somnia dashboard route intentionally avoids importing Mantle app internals so the Somnia build stays isolated.
        </p>
      </div>
    </div>
  );
}
