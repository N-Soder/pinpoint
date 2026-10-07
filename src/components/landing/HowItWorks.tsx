import { Check } from "lucide-react";
import { PinMarker } from "./parts";

const steps = [
  {
    title: "Paste one script tag",
    body: "Create a project in the dashboard and add its snippet to your site. The widget is plain JavaScript with no build step.",
    example: (
      <pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs leading-5">
        {'<script src="https://your-pinpoint-host/widget.js?project=PROJECT_ID"></script>'}
      </pre>
    ),
  },
  {
    title: "Share the page with ?review=1",
    body: "The widget stays hidden from ordinary visitors. Reviewers open the link, press Feedback, click the thing they mean and type.",
    example: (
      <code className="block rounded-md bg-muted p-3 text-xs">
        staging.acme.co/pricing
        <span className="rounded bg-primary/10 px-1 py-0.5 font-medium text-primary">?review=1</span>
      </code>
    ),
  },
  {
    title: "Work through the list",
    body: "Pins arrive in your dashboard grouped by page. Open the page, fix it, mark it resolved.",
    example: (
      <div aria-hidden="true" className="divide-y divide-border rounded-md border border-border text-xs">
        <div className="flex items-center gap-2.5 p-2.5">
          <PinMarker n={1} className="h-5 w-5 text-[10px]" />
          <span className="min-w-0 flex-1 truncate">This button is cut off on mobile.</span>
          <span className="shrink-0 font-medium text-primary">Resolve</span>
        </div>
        <div className="flex items-center gap-2.5 p-2.5 text-muted-foreground">
          <PinMarker n={2} resolved className="h-5 w-5 text-[10px]" />
          <span className="min-w-0 flex-1 truncate line-through">Typo in the second paragraph</span>
          <Check className="h-3.5 w-3.5 shrink-0" />
        </div>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="scroll-mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 id="how-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title}>
              <p aria-hidden="true" className="font-code text-sm font-medium text-primary">
                0{i + 1}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              <div className="mt-4">{step.example}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
