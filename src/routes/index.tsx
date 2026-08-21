import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  Radar,
  TrendingUp,
  Hash,
  Layers,
  Bot,
  Cpu,
  Shield,
  Zap,
  Radio,
  BarChart3,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  // DIRECT ACCESS — opening the app lands on Sentinel, never on a forced
  // create-account page. The marketing landing stays reachable at /?home=1.
  beforeLoad: ({ search }) => {
    if (!(search as { home?: string }).home) throw redirect({ to: "/app/apex" });
  },
  head: () => ({
    meta: [
      { title: "Precision Edge — AI-powered Deriv trading intelligence" },
      {
        name: "description",
        content:
          "Real-time AI market scanner, high-confidence signal engine and automated trading for Deriv synthetic indices. Connect your Deriv account and trade smarter.",
      },
      { property: "og:title", content: "Precision Edge — AI-powered Deriv trading intelligence" },
      {
        property: "og:description",
        content:
          "Real-time AI market scanner, high-confidence signal engine and automated trading for Deriv synthetic indices. Connect your Deriv account and trade smarter.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen grid-bg">
      <Nav />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 glass border-b border-border/40">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[var(--neon)] to-[var(--accent)] flex items-center justify-center">
            <Activity size={18} className="text-[var(--primary-foreground)]" />
          </div>
          <div>
            <div className="text-base font-bold tracking-wide neon-text">
              PRECISION <span className="text-[var(--accent)]">EDGE</span>
            </div>
            <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
              AI Trading Platform
            </div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-widest text-muted-foreground">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/app/apex"
            className="h-9 px-4 rounded-md border border-border/60 text-xs hover:bg-secondary/50 flex items-center"
          >
            Open Sentinel
          </Link>
          <Link
            to="/app/dashboard"
            className="h-9 px-4 rounded-md bg-[var(--neon)]/20 border border-[var(--neon)]/50 text-xs text-[var(--neon)] font-semibold hover:bg-[var(--neon)]/30 flex items-center gap-1"
          >
            Get started <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 py-24 md:py-32 relative">
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, oklch(0.4 0.2 200 / 0.35), transparent 60%), radial-gradient(circle at 70% 70%, oklch(0.4 0.22 310 / 0.3), transparent 60%)",
          }}
        />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[var(--neon)] border border-[var(--neon)]/40 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon)] pulse-dot" /> Live AI engine
            · 24 markets
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            AI-powered edge for the{" "}
            <span className="neon-text bg-gradient-to-r from-[var(--neon)] to-[var(--accent)] bg-clip-text text-transparent">
              Deriv synthetics
            </span>{" "}
            markets.
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Precision Edge continuously scans every Volatility, 1s, and Jump index on Deriv —
            combining trend, momentum, digit statistics and probability engines to surface only
            high-confidence signals. Connect your Deriv account, receive signals in real time, and
            automate strategies.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/app/dashboard"
              className="h-11 px-6 rounded-md bg-[var(--neon)]/20 border border-[var(--neon)]/50 text-sm font-semibold text-[var(--neon)] hover:bg-[var(--neon)]/30 flex items-center gap-2"
            >
              Open the terminal <ChevronRight size={14} />
            </Link>
            <a
              href="#features"
              className="h-11 px-6 rounded-md border border-border/60 text-sm hover:bg-secondary/50 flex items-center"
            >
              See how it works
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-6 text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-[var(--bull)]" /> No card required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-[var(--bull)]" /> Real Deriv WebSocket API
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-[var(--bull)]" /> Dark mode by default
            </span>
          </div>
        </div>

        <div className="mt-16 relative">
          <div className="glass rounded-xl border border-border/40 p-4 overflow-hidden">
            <TickerStrip />
          </div>
        </div>
      </div>
    </section>
  );
}

function TickerStrip() {
  const items = [
    { s: "R_100", n: "Volatility 100", v: "+1.24%" },
    { s: "R_75", n: "Volatility 75", v: "-0.31%" },
    { s: "R_50", n: "Volatility 50", v: "+0.87%" },
    { s: "1HZ100V", n: "Vol 100 (1s)", v: "+2.05%" },
    { s: "JD100", n: "Jump 100", v: "-0.42%" },
    { s: "BOOM1000", n: "Boom 1000", v: "+1.91%" },
    { s: "CRASH1000", n: "Crash 1000", v: "-1.03%" },
    { s: "R_25", n: "Volatility 25", v: "+0.15%" },
  ];
  return (
    <div className="flex gap-3 overflow-hidden">
      {[...items, ...items].map((it, i) => {
        const up = it.v.startsWith("+");
        return (
          <div
            key={i}
            className="shrink-0 rounded-lg border border-border/50 bg-secondary/30 px-4 py-2 min-w-[180px]"
          >
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{it.s}</div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-sm font-semibold">{it.n}</div>
              <div
                className={`tabular text-sm font-bold ${up ? "text-[var(--bull)]" : "text-[var(--bear)]"}`}
              >
                {it.v}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.floor(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span>
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

function Stats() {
  return (
    <section className="border-y border-border/40 bg-secondary/10">
      <div className="max-w-[1400px] mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { v: 24, s: "", l: "Markets scanned live" },
          { v: 6, s: "", l: "Statistical models" },
          { v: 1000, s: "t", l: "Rolling tick buffer" },
          { v: 70, s: "%+", l: "Min signal confidence" },
        ].map((it, i) => (
          <div key={i} className="text-center">
            <div className="tabular text-3xl md:text-4xl font-bold neon-text">
              <AnimatedNumber value={it.v} suffix={it.s} />
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">
              {it.l}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Radar,
      title: "AI Multi-Market Scanner",
      desc: "24 Deriv synthetic markets analyzed in parallel with a 6-model probability engine.",
    },
    {
      icon: TrendingUp,
      title: "Rise / Fall Intelligence",
      desc: "Weighted trend, momentum, MACD, RSI and multi-timeframe agreement produce Rise or Fall calls above 70% confidence.",
    },
    {
      icon: Hash,
      title: "Digit Analytics",
      desc: "Live digit frequency, hot/cold/rising detection, veto rules, and Over/Under signal firing.",
    },
    {
      icon: Layers,
      title: "Volatility & Jump Scanner",
      desc: "Over 2 and Under 7 strategy scanners with cooldowns and secondary bot-gate confirmations.",
    },
    {
      icon: Bot,
      title: "Bot Builder + DBot XML",
      desc: "Compose strategies visually or import your existing DBot XML files. Recovery, martingale and money-management built in.",
    },
    {
      icon: Cpu,
      title: "Automated Trading",
      desc: "Run signals as trades with risk limits, take-profit, stop-loss and auto-pause on losing streaks.",
    },
    {
      icon: BarChart3,
      title: "Performance Analytics",
      desc: "Win rate, profit factor, expectancy, drawdown, equity curve — plus a trading journal.",
    },
    {
      icon: Shield,
      title: "Real Deriv API",
      desc: "Direct WebSocket connection with reconnect, heartbeat and graceful error handling.",
    },
  ];
  return (
    <section id="features" className="max-w-[1400px] mx-auto px-6 py-24">
      <div className="max-w-2xl mb-14">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--accent)] mb-3">
          Platform
        </div>
        <h2 className="text-3xl md:text-4xl font-bold">One platform. Every edge.</h2>
        <p className="text-muted-foreground mt-3">
          Precision Edge combines the analytical intelligence of MainAFX with a full Deriv trading
          platform — signals, execution, automation and analytics in a single unified workspace.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((it, i) => (
          <div
            key={i}
            className="glass rounded-lg p-5 hover:border-[var(--neon)]/50 border transition-colors"
          >
            <div className="w-9 h-9 rounded-md bg-[var(--neon)]/15 border border-[var(--neon)]/40 flex items-center justify-center mb-4">
              <it.icon size={18} className="text-[var(--neon)]" />
            </div>
            <h3 className="text-sm font-semibold mb-1">{it.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Shield,
      t: "Connect",
      d: "No account needed — open the terminal and link your Deriv account with one OAuth click. No API keys to paste.",
    },
    {
      icon: Radar,
      t: "Analyze",
      d: "The AI engine continuously scans 24 markets. Only signals above your confidence threshold reach the feed.",
    },
    {
      icon: Zap,
      t: "Trade",
      d: "Trade signals manually with one click, or hand them to the automation engine with your risk profile.",
    },
  ];
  return (
    <section id="how" className="border-y border-border/40 bg-secondary/10">
      <div className="max-w-[1400px] mx-auto px-6 py-24">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--accent)] mb-3">
          How it works
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-14">
          From market noise to executed trade — in three steps.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <div key={i} className="glass rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[var(--neon)] to-[var(--accent)] flex items-center justify-center">
                  <s.icon size={18} className="text-[var(--primary-foreground)]" />
                </div>
                <div className="tabular text-3xl font-bold text-muted-foreground/40">0{i + 1}</div>
              </div>
              <h3 className="text-lg font-semibold mb-2">{s.t}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Starter",
      price: "Free",
      features: ["Live AI scanner", "3 markets", "Manual trading", "Community support"],
    },
    {
      name: "Pro",
      price: "$29/mo",
      features: [
        "All 24 markets",
        "Auto trading",
        "Bot builder + DBot XML",
        "Analytics + journal",
        "Priority support",
      ],
      featured: true,
    },
    {
      name: "Institutional",
      price: "Contact us",
      features: ["Everything in Pro", "Custom strategies", "API access", "Dedicated support"],
    },
  ];
  return (
    <section id="pricing" className="max-w-[1400px] mx-auto px-6 py-24">
      <div className="text-center mb-14">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--accent)] mb-3">
          Pricing
        </div>
        <h2 className="text-3xl md:text-4xl font-bold">Start free. Scale when you're ready.</h2>
        <p className="text-muted-foreground mt-3 text-sm">
          Paid tiers coming soon — everything is free during the beta.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`glass rounded-lg p-6 ${t.featured ? "border-[var(--neon)]/60 neon-border" : ""}`}
          >
            {t.featured && (
              <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--neon)] mb-2">
                Most popular
              </div>
            )}
            <h3 className="text-lg font-semibold">{t.name}</h3>
            <div className="tabular text-3xl font-bold mt-2">{t.price}</div>
            <ul className="mt-6 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-[var(--neon)] mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <Link
              to="/app/dashboard"
              className={`mt-6 w-full h-10 rounded-md text-sm font-semibold flex items-center justify-center gap-2 ${t.featured ? "bg-[var(--neon)]/20 border border-[var(--neon)]/50 text-[var(--neon)] hover:bg-[var(--neon)]/30" : "border border-border/60 hover:bg-secondary/50"}`}
            >
              Get started <ChevronRight size={12} />
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const qs = [
    {
      q: "Do I need a Deriv account?",
      a: "Yes — Precision Edge is a third-party analysis and trading platform for Deriv synthetic indices. You'll connect your Deriv account via OAuth so trades execute against your own balance.",
    },
    {
      q: "Is my Deriv account safe?",
      a: "We never see your Deriv password. Authentication uses Deriv's official OAuth flow and tokens are stored server-side, encrypted, tied to your user account and never exposed to the browser bundle.",
    },
    {
      q: "Which markets are supported?",
      a: "All Deriv synthetic indices — Volatility 10/25/50/75/100, their 1-second variants, Jump 10-100, and Boom/Crash 300N/500/1000.",
    },
    {
      q: "Can I import my existing DBot bots?",
      a: "Yes. The Bot Library imports and exports Deriv DBot-compatible XML strategies. You can also compose new strategies visually in the Bot Builder.",
    },
    {
      q: "Is this financial advice?",
      a: "No. Precision Edge is a research and execution tool. Trading synthetic indices carries risk of loss. You are responsible for every trade placed from your account.",
    },
  ];
  return (
    <section id="faq" className="border-y border-border/40 bg-secondary/10">
      <div className="max-w-[900px] mx-auto px-6 py-24">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--accent)] mb-3">FAQ</div>
        <h2 className="text-3xl md:text-4xl font-bold mb-10">Frequently asked questions</h2>
        <div className="space-y-3">
          {qs.map((it, i) => (
            <details key={i} className="glass rounded-lg group">
              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold flex items-center justify-between list-none">
                {it.q}
                <ChevronRight
                  size={16}
                  className="transition-transform group-open:rotate-90 text-muted-foreground"
                />
              </summary>
              <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{it.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="max-w-[1400px] mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[var(--neon)] to-[var(--accent)] flex items-center justify-center">
            <Activity size={16} className="text-[var(--primary-foreground)]" />
          </div>
          <div>
            <div className="text-sm font-bold neon-text">PRECISION EDGE</div>
            <div className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
              AI Trading Platform
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
          <a href="#features" className="hover:text-foreground">
            Features
          </a>
          <a href="#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <a href="#faq" className="hover:text-foreground">
            FAQ
          </a>
          <Link to="/app/apex" className="hover:text-foreground">
            Sentinel
          </Link>
        </div>
      </div>
      <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-[10px] uppercase tracking-widest text-muted-foreground">
        <div>
          © {new Date().getFullYear()} Precision Edge · Not affiliated with Deriv · Trading involves
          risk
        </div>
        <div className="flex items-center gap-2">
          <Radio size={10} className="text-[var(--neon)] pulse-dot" /> Live signal engine
        </div>
      </div>
    </footer>
  );
}
