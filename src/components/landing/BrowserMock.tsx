import { PinMarker } from "./parts";

/** A drawn example of the widget in review mode: one pin on a button, with the reviewer's comment. */
export function BrowserMock() {
  return (
    <div
      role="img"
      aria-label="Example: on a staging pricing page opened with ?review=1, a reviewer has pinned the comment “This button is cut off on mobile” to a button."
      className="rounded-lg border border-border bg-card shadow-xs"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
        </div>
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-3 py-1 text-xs text-muted-foreground">
          staging.acme.co/pricing<span className="font-medium text-primary">?review=1</span>
        </code>
      </div>

      <div className="relative px-6 pb-16 pt-7 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Acme Studio</p>
        <p className="mt-2 font-display text-xl font-semibold">Simple pricing for small teams</p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">One plan, every feature. Cancel whenever you like.</p>

        <div className="relative mt-5 inline-block">
          <span className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background outline-2 outline-offset-2 outline-primary">
            Start your free 14-day tri…
          </span>
          <PinMarker n={1} className="absolute -right-3 -top-3 ring-2 ring-white" />
        </div>

        <div className="mt-4 max-w-[19rem] rounded-lg border border-border bg-background p-3.5 shadow-lg sm:ml-16">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">Sam</span>
            <span className="text-muted-foreground">2 min ago</span>
          </div>
          <p className="mt-1.5 text-sm leading-snug">This button is cut off on mobile. Can we shorten the label?</p>
          <code className="mt-2.5 block truncate border-t border-border pt-2 text-[11px] text-muted-foreground">
            section.plans button.cta · Chrome · 390×844
          </code>
        </div>

        <span className="absolute bottom-4 right-4 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-md">
          💬 Feedback
        </span>
      </div>
    </div>
  );
}
