import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrowserMock } from "@/components/landing/BrowserMock";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { OpenSource } from "@/components/landing/OpenSource";
import { GitHubMark, Wordmark } from "@/components/landing/parts";
import { fetchContactEmail } from "@/lib/api";
import { LICENSE_URL, REPO_URL, SECURITY_MODEL_URL } from "@/lib/site";

const pinDetails = [
  { term: "Comment", detail: "What the reviewer typed, plus their name if they gave one." },
  { term: "Element", detail: "The CSS selector and visible text of what they clicked." },
  { term: "Screenshot", detail: "Optional. Captured in the reviewer's browser." },
  { term: "Page", detail: "The URL the comment was left on. Pins are grouped by page." },
  { term: "Browser", detail: "Browser and viewport size, so you can reproduce it." },
  { term: "Status", detail: "Resolve from the dashboard or straight from the page." },
];

const navLink = "rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground";

export default function Landing() {
  // Set per instance with the CONTACT_EMAIL secret; the contact section stays hidden without it.
  const { data: contactEmail } = useQuery({ queryKey: ["contact-email"], queryFn: fetchContactEmail, staleTime: Infinity });
  const contactHref = `mailto:${contactEmail}?subject=${encodeURIComponent("Trying Pinpoint")}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Wordmark />
          <nav aria-label="Main" className="flex items-center gap-1 text-sm">
            <a href="#how" className={`hidden md:block ${navLink}`}>
              How it works
            </a>
            <a href="#open-source" className={`hidden md:block ${navLink}`}>
              Open source
            </a>
            {contactEmail && (
              <a href="#try" className={`hidden md:block ${navLink}`}>
                Try it
              </a>
            )}
            <Link to="/admin" className={navLink}>
              Admin
            </Link>
            <Button asChild variant="outline" size="sm" className="ml-2 gap-2">
              <a href={REPO_URL}>
                <GitHubMark className="h-4 w-4" />
                GitHub
              </a>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_1.05fr] lg:py-24">
          <div>
            <a
              href={REPO_URL}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <GitHubMark className="h-4 w-4" />
              Open source · AGPL-3.0
            </a>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Website feedback, pinned to the element it&rsquo;s about.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Clients and teammates click anything on the page and leave a comment right there. You get the comment, the
              exact element, a screenshot and their browser details in one list.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <a href={REPO_URL}>
                  <GitHubMark className="h-4 w-4" />
                  Get it on GitHub
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost" className="gap-2">
                <a href="#how">
                  See how it works
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No accounts for reviewers", "No browser extension", "Runs on your own Cloudflare account"].map((point) => (
                <li key={point} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <BrowserMock />
        </section>

        <HowItWorks />

        <section aria-labelledby="pin-heading" className="border-t border-border bg-muted/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1fr_2fr]">
            <div>
              <h2 id="pin-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
                What you get with each pin
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Enough to find the problem and reproduce it without a follow-up email.
              </p>
            </div>
            <dl className="grid gap-x-10 sm:grid-cols-2">
              {pinDetails.map((item) => (
                <div key={item.term} className="border-t border-border py-4">
                  <dt className="font-semibold">{item.term}</dt>
                  <dd className="mt-1 text-sm text-muted-foreground">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <OpenSource />

        <section className="mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-6 py-20 lg:grid-cols-2">
          {contactEmail && (
            <div id="try" className="scroll-mt-24">
              <h2 className="text-2xl font-bold tracking-tight">Try it before you host it</h2>
              <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
                This site runs Pinpoint. If you&rsquo;d like to try it on a real project without deploying anything,
                email me and I&rsquo;ll set one up for you here.
              </p>
              <Button asChild variant="outline" size="lg" className="mt-6 gap-2">
                <a href={contactHref}>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {contactEmail}
                </a>
              </Button>
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Built for staging and review sites</h2>
            <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
              Anyone who can see a project&rsquo;s embed snippet can read and add pins for that project, so put it where
              that is fine.{" "}
              <a href={SECURITY_MODEL_URL} className="text-primary underline underline-offset-4">
                Read the security model
              </a>
              .
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted-foreground">
          <Wordmark className="text-sm text-foreground" />
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href={REPO_URL} className="transition-colors hover:text-foreground">
              GitHub
            </a>
            <a href={LICENSE_URL} className="transition-colors hover:text-foreground">
              AGPL-3.0
            </a>
            {contactEmail && (
              <a href={contactHref} className="transition-colors hover:text-foreground">
                Contact
              </a>
            )}
            <Link to="/admin" className="transition-colors hover:text-foreground">
              Admin login
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
