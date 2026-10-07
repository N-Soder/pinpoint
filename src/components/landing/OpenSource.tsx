import { Button } from "@/components/ui/button";
import { DEPLOY_GUIDE_URL, LICENSE_URL, REPO_NAME, REPO_URL } from "@/lib/site";
import { GitHubMark } from "./parts";

// Mirrors the README's deployment steps; the guide linked beside it has the details.
const selfHostCommands = [
  { command: "git clone https://github.com/N-Soder/pinpoint" },
  { command: "cd pinpoint && npm ci" },
  { command: "npx wrangler d1 create pinpoint-db", note: "then put its ID in wrangler.toml" },
  { command: "npm run db:migrate:remote" },
  { command: "npx wrangler pages secret put ADMIN_PASSWORD" },
  { command: "npm run deploy" },
];

export function OpenSource() {
  return (
    <section id="open-source" aria-labelledby="oss-heading" className="scroll-mt-16 bg-foreground text-background">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-sm text-background/60">
            <GitHubMark className="h-4 w-4" />
            {REPO_NAME}
          </p>
          <h2 id="oss-heading" className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Open source, and yours to run.
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-background/70">
            Pinpoint is free software under the{" "}
            <a href={LICENSE_URL} className="text-background underline underline-offset-4">
              AGPL-3.0 licence
            </a>
            . Deploy it to your own Cloudflare account and the feedback stays in your own database.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2 bg-background text-foreground hover:bg-background/90">
              <a href={REPO_URL}>
                <GitHubMark className="h-4 w-4" />
                View the source
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-background hover:bg-background/10 hover:text-background">
              <a href={DEPLOY_GUIDE_URL}>Deployment guide</a>
            </Button>
          </div>
        </div>
        <div className="min-w-0">
          <pre className="overflow-x-auto rounded-md bg-background/10 p-4 text-[13px] leading-6">
            {selfHostCommands.map(({ command, note }) => (
              <span key={command} className="block">
                <span className="select-none text-background/40">$ </span>
                {command}
                {note && <span className="block text-background/50">{`# ${note}`}</span>}
              </span>
            ))}
          </pre>
          <p className="mt-4 text-sm text-background/60">
            Cloudflare Pages serves the dashboard and API. Cloudflare D1 stores the pins.
          </p>
        </div>
      </div>
    </section>
  );
}
