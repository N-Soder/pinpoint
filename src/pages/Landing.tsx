import { Link } from "react-router-dom";
import { Crosshair, MousePointerClick, LayoutDashboard, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: MousePointerClick,
    title: "Click to comment",
    description:
      "Click any element on your live site to leave a pinned, in-context comment. No screenshots, no vague emails.",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    icon: LayoutDashboard,
    title: "Centralized dashboard",
    description:
      "All feedback organized by project and page URL. Resolve items as you go and track what's still open.",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
  {
    icon: Code2,
    title: "One-line embed",
    description:
      "Drop a single <script> tag into any website to activate the feedback widget instantly.",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
  },
];

const steps = [
  { number: "1", title: "Add the script", body: "Copy your project's embed snippet and paste it into your site's HTML." },
  { number: "2", title: "Click any element", body: "Open your site, click anything, and type your feedback comment." },
  { number: "3", title: "Review & resolve", body: "Open the admin dashboard to view, filter, and resolve all feedback." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Crosshair className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-sm tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Pinpoint</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/admin">Admin Login</Link>
        </Button>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/60 via-white to-white">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="pointer-events-none absolute -top-16 right-0 h-72 w-72 rounded-full bg-indigo-200/25 blur-3xl" />

          <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 p-4 ring-1 ring-blue-200/60">
              <Crosshair className="h-10 w-10 text-blue-600" />
            </div>
            <h1 className="mb-4 text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
              Pinpoint
            </h1>
            <p className="mb-3 text-xl font-semibold text-foreground">
              In-context website feedback, simplified.
            </p>
            <p className="mb-10 text-muted-foreground text-lg leading-relaxed max-w-xl mx-auto">
              Click any element on your site to leave in-context feedback. Comments are
              stored and reviewable in a simple admin dashboard.
            </p>
            <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-0 shadow-md shadow-blue-200">
              <Link to="/admin">
                Go to Admin Panel
                <span aria-hidden>→</span>
              </Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="border-y border-border py-20 px-6 bg-gradient-to-b from-white to-slate-50/80">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-2 text-center text-2xl font-bold">Everything you need</h2>
            <p className="mb-12 text-center text-muted-foreground text-sm">Three features. Zero friction.</p>
            <div className="grid gap-6 sm:grid-cols-3">
              {features.map((f) => (
                <Card key={f.title} className="border-border hover:border-blue-200 hover:shadow-md transition-all duration-200">
                  <CardContent className="pt-6 space-y-3">
                    <div className={`inline-flex items-center justify-center rounded-lg ${f.iconBg} p-2.5`}>
                      <f.icon className={`h-5 w-5 ${f.iconColor}`} />
                    </div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="mb-2 text-center text-2xl font-bold">How it works</h2>
          <p className="mb-12 text-center text-muted-foreground text-sm">Up and running in minutes.</p>
          <div className="space-y-8">
            {steps.map((step) => (
              <div key={step.number} className="flex gap-5 items-start">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm shadow-md shadow-blue-200">
                  {step.number}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA banner */}
        <section className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white py-16 px-6 text-center relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
          <div className="relative">
            <h2 className="mb-4 text-2xl font-bold">Ready to review your feedback?</h2>
            <p className="mb-8 text-white/75 max-w-md mx-auto">
              Log in to the admin panel to manage your projects and resolve open pins.
            </p>
            <Button asChild size="lg" className="gap-2 bg-white text-blue-700 hover:bg-blue-50 border-0 font-semibold shadow-lg">
              <Link to="/admin">
                Open Admin Panel
                <span aria-hidden>→</span>
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5">
            <Crosshair className="h-3.5 w-3.5" />
            <span>Pinpoint</span>
          </div>
          <span>·</span>
          <Link to="/admin" className="hover:text-foreground transition-colors">
            Admin Login
          </Link>
        </div>
      </footer>
    </div>
  );
}
