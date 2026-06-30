import { useState } from "react";
import { Heart, AlertCircle, Bell } from "lucide-react";
import { PixelSprite } from "./PixelArt.tsx";
import { SEASON_ART } from "./seasonArt.ts";

type SubscribeMode = "waitlist" | "autopay";

const RupeeFund = () => {
  const [currentScreen, setCurrentScreen] = useState("home");
  const [amount, setAmount] = useState("100");
  const [subscribeMode, setSubscribeMode] = useState<SubscribeMode>("waitlist");

  const goSubscribe = (mode: SubscribeMode) => {
    setSubscribeMode(mode);
    setCurrentScreen("subscribe");
  };

  const navLink = (screen: string, label: string) => (
    <button
      onClick={() => setCurrentScreen(screen)}
      className={`font-medium transition-colors text-sm pb-1 ${currentScreen === screen ? "text-ink marker-underline" : "text-ink-2 hover:text-brand"}`}
    >
      {label}
    </button>
  );

  const renderHeader = () => (
    <header className="bg-white border-b-2 border-ink sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img
              src="/logo-foss-united-rupee-fund.png"
              alt="The Rupee Fund by FOSS United"
              className="h-9 w-auto"
            />
          </div>
          <nav className="flex gap-6 items-center">
            {navLink("home", "Home")}
            {navLink("projects", "Projects")}
            {navLink("manage", "Manage")}
            <button
              onClick={() => goSubscribe("autopay")}
              className="bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-700 font-semibold transition-colors text-sm"
            >
              Subscribe
            </button>
          </nav>
        </div>
      </div>
    </header>
  );

  const eyebrow = (text: string) => (
    <span className="inline-flex items-center gap-2 border border-ink/15 bg-card px-3 py-1.5 text-xs leading-none font-mono font-bold uppercase tracking-wider text-brand">
      <span className="w-2 h-2 bg-brand inline-block" />
      {text}
    </span>
  );

  const renderHome = () => (
    <div className="bg-paper">
      {renderHeader()}

      {/* Hero Section - Compact */}
      <section className="bg-white hero-glow border-b border-ink/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="mb-4">
                {eyebrow(
                  "A FOSS United Initiative · Launching at IndiaFOSS 2026",
                )}
              </div>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-ink mb-4 leading-[1.05] tracking-tight">
                Keep Indian open source alive — one rupee at a time
              </h2>
              <p className="text-base text-ink-2 mb-5 leading-relaxed">
                Free software isn't free. The Rupee Fund pools small monthly UPI
                contributions — from just ₹10 — and routes them to indie FOSS
                maintainers and builders across India. Not charity. Membership
                in a commons.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => goSubscribe("autopay")}
                  className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-700 transition-colors inline-flex items-center gap-2"
                >
                  <Heart size={18} />
                  Become a Founding Contributor
                </button>
                <button
                  onClick={() => goSubscribe("waitlist")}
                  className="bg-white text-ink border border-ink/20 px-6 py-3 rounded-lg font-semibold hover:border-brand hover:text-brand transition-colors inline-flex items-center gap-2"
                >
                  <Bell size={18} />
                  Notify me at launch
                </button>
              </div>
            </div>

            {/* Ecosystem credibility - attributed, not claimed */}
            <div>
              <p className="mb-3 text-xs font-mono font-bold uppercase tracking-wider text-ink-3">
                Part of India's FOSS funding movement
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-card p-4 rounded-lg border border-ink/10 shadow-soft text-center">
                  <div className="text-2xl font-mono font-bold text-brand mb-1">
                    ₹3cr+
                  </div>
                  <div className="text-xs text-ink-3">
                    disbursed by FOSS United grants
                  </div>
                </div>
                <div className="bg-card p-4 rounded-lg border border-ink/10 shadow-soft text-center">
                  <div className="text-2xl font-mono font-bold text-brand mb-1">
                    27+
                  </div>
                  <div className="text-xs text-ink-3">
                    projects funded by FOSS United grants
                  </div>
                </div>
                <div className="bg-card p-4 rounded-lg border border-ink/10 shadow-soft text-center">
                  <div className="text-2xl font-mono font-bold text-brand mb-1">
                    $1M/yr
                  </div>
                  <div className="text-xs text-ink-3">
                    committed by Zerodha's FLOSS/fund
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-3 leading-relaxed">
                FOSS United grants and FLOSS/fund are separate programs. The
                Rupee Fund is the community-pooled layer — funded by you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Launch ribbon */}
      <div className="bg-brand-50 border-b border-brand-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 text-center text-xs font-medium text-brand-800">
          Season 1 opens at IndiaFOSS 2026 — 26–27 Sep, Bengaluru · Be founding
          contributor #1
        </div>
      </div>

      {/* How It Works + Seasons - Combined */}
      <section className="py-12 bg-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-10">
            {/* How It Works */}
            <div>
              <h3 className="text-2xl font-bold text-ink mb-5 tracking-tight">
                How It Works
              </h3>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="bg-brand w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-mono font-bold text-sm">
                      1
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1 text-ink">
                      Subscribe
                    </h4>
                    <p className="text-ink-3 text-xs">
                      Set up monthly UPI AutoPay from ₹10. Founding contributors
                      lock in from Season 1.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="bg-brand w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-mono font-bold text-sm">
                      2
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1 text-ink">
                      Pool Funds
                    </h4>
                    <p className="text-ink-3 text-xs">
                      Your contributions pool through the season.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="bg-brand w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-mono font-bold text-sm">
                      3
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1 text-ink">
                      Vote
                    </h4>
                    <p className="text-ink-3 text-xs">
                      Contribute 10+ months and help vote on who gets funded.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="bg-brand w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-mono font-bold text-sm">
                      4
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1 text-ink">
                      Disburse
                    </h4>
                    <p className="text-ink-3 text-xs">
                      Funds go to indie FOSS maintainers and builders across
                      India.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Funding Seasons */}
            <div>
              <h3 className="text-2xl font-bold text-ink mb-5 tracking-tight">
                Funding Seasons
              </h3>
              <div className="space-y-3">
                {SEASON_ART.map((s) => (
                  <div
                    key={s.key}
                    className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-ink/10 bg-white p-4 shadow-soft transition-transform hover:-translate-y-0.5"
                    style={{ backgroundImage: s.grad }}
                  >
                    <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border border-ink/10 bg-card">
                      <PixelSprite
                        rows={s.sprite}
                        shades={s.shades}
                        className="h-14 w-14"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-lg font-extrabold tracking-tight text-ink sm:text-xl">
                        {s.name}
                      </h4>
                      <div
                        className="my-2 h-1 w-10 rounded-full"
                        style={{ backgroundColor: s.accent }}
                      />
                      <p className="text-xs font-medium uppercase tracking-wider text-ink-3">
                        {s.months}
                      </p>
                    </div>
                    <span
                      className="self-start rounded-md px-2.5 py-1 text-xs font-semibold text-white"
                      style={{ backgroundColor: s.accent }}
                    >
                      {s.duration}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ - Compact */}
      <section className="py-12 bg-white border-t border-ink/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-ink mb-5 tracking-tight">
            Frequently Asked Questions
          </h3>
          <div className="space-y-2">
            <details className="bg-card p-4 rounded-lg border border-ink/10 shadow-soft group">
              <summary className="font-semibold text-sm cursor-pointer text-ink flex justify-between items-center">
                <span>Is the fund live yet?</span>
                <span className="text-brand text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-2 text-xs leading-relaxed border-t border-ink/10 pt-3">
                Not yet — we launch at IndiaFOSS 2026, on 26–27 September in
                Bengaluru. Founding contributors who join now seed Season 1's
                pool and lock in early voting eligibility.
              </p>
            </details>
            <details className="bg-card p-4 rounded-lg border border-ink/10 shadow-soft group">
              <summary className="font-semibold text-sm cursor-pointer text-ink flex justify-between items-center">
                <span>Why this fund?</span>
                <span className="text-brand text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-2 text-xs leading-relaxed border-t border-ink/10 pt-3">
                Free software isn't free. It can be inexpensive and sustainable
                when paid for by a large pool of users. Minimum is ₹10, which
                even most students can afford.
              </p>
            </details>
            <details className="bg-card p-4 rounded-lg border border-ink/10 shadow-soft group">
              <summary className="font-semibold text-sm cursor-pointer text-ink flex justify-between items-center">
                <span>
                  How is this different from FOSS United grants or FLOSS/fund?
                </span>
                <span className="text-brand text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-2 text-xs leading-relaxed border-t border-ink/10 pt-3">
                Those are large, foundation- and company-funded grants (₹3cr+
                from FOSS United; $1M a year from Zerodha's FLOSS/fund). The
                Rupee Fund is the community layer — thousands of ₹10s, pooled
                and voted on by contributors like you.
              </p>
            </details>
            <details className="bg-card p-4 rounded-lg border border-ink/10 shadow-soft group">
              <summary className="font-semibold text-sm cursor-pointer text-ink flex justify-between items-center">
                <span>Who will be funded?</span>
                <span className="text-brand text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-2 text-xs leading-relaxed border-t border-ink/10 pt-3">
                Funding based on community voting. Contributors with 10+ months
                get voting rights for each season.
              </p>
            </details>
            <details className="bg-card p-4 rounded-lg border border-ink/10 shadow-soft group">
              <summary className="font-semibold text-sm cursor-pointer text-ink flex justify-between items-center">
                <span>Will this fund international projects?</span>
                <span className="text-brand text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-2 text-xs leading-relaxed border-t border-ink/10 pt-3">
                No, but you can fund Indian contributors of international
                projects.
              </p>
            </details>
            <details className="bg-card p-4 rounded-lg border border-ink/10 shadow-soft group">
              <summary className="font-semibold text-sm cursor-pointer text-ink flex justify-between items-center">
                <span>Can I donate anonymously?</span>
                <span className="text-brand text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-2 text-xs leading-relaxed border-t border-ink/10 pt-3">
                No. We comply with all statutory requirements, so anonymous
                donations are not supported.
              </p>
            </details>
            <details className="bg-card p-4 rounded-lg border border-ink/10 shadow-soft group">
              <summary className="font-semibold text-sm cursor-pointer text-ink flex justify-between items-center">
                <span>How are costs handled?</span>
                <span className="text-brand text-xl group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-2 text-xs leading-relaxed border-t border-ink/10 pt-3">
                Total fund minus administrative overheads equals the funding
                pool. All costs documented transparently.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* Footer - Compact */}
      <footer className="bg-ink footer-glow text-gray-400 py-10 border-t-2 border-brand">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-white rounded-lg p-2 inline-flex">
                  <img
                    src="/logo-rupee-fund.png"
                    alt="The Rupee Fund"
                    className="h-6 w-auto"
                  />
                </span>
                <span className="text-xs text-gray-400">by FOSS United</span>
              </div>
              <p className="text-xs leading-relaxed text-gray-400">
                Supporting small, indie FOSS maintainers and builders across
                India.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">
                Quick Links
              </h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li>
                  <button
                    onClick={() => setCurrentScreen("projects")}
                    className="hover:text-brand transition-colors"
                  >
                    How Funding Works
                  </button>
                </li>
                <li>
                  <a
                    href="https://fossunited.org/about"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand transition-colors"
                  >
                    About FOSS United
                  </a>
                </li>
                <li>
                  <a
                    href="https://forum.fossunited.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand transition-colors"
                  >
                    Community Forum
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/fossunited/fossunited"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand transition-colors"
                  >
                    Source on GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-sm">Contact</h4>
              <p className="text-xs mb-2 text-gray-400">
                <a
                  href="mailto:foundation@fossunited.org"
                  className="hover:text-brand transition-colors"
                >
                  foundation@fossunited.org
                </a>
              </p>
              <p className="text-xs mb-2 leading-relaxed text-gray-400">
                FOSS United Foundation
                <br />
                D-324 Neelkanth Business Park,
                <br />
                Vidyavihar, Mumbai, India
              </p>
              <p className="text-xs mb-3 font-mono text-gray-500">
                CIN: U74999MH2016NPL288653
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                <a
                  href="https://x.com/fossunited"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand transition-colors"
                >
                  X
                </a>
                <a
                  href="https://mas.to/@fossunited"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand transition-colors"
                >
                  Mastodon
                </a>
                <a
                  href="https://in.linkedin.com/company/fossunited"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand transition-colors"
                >
                  LinkedIn
                </a>
                <a
                  href="https://www.youtube.com/c/fossunited"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand transition-colors"
                >
                  YouTube
                </a>
                <a
                  href="https://t.me/fossunited"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand transition-colors"
                >
                  Telegram
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center text-xs text-gray-500">
            <p>© 2026 The Rupee Fund. A FOSS United Foundation initiative.</p>
          </div>
        </div>
      </footer>
    </div>
  );

  const renderSubscribe = () => (
    <div className="min-h-screen bg-paper">
      {renderHeader()}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg border border-ink/10 shadow-soft p-6">
          <div className="text-center mb-6">
            <div className="inline-block p-3 bg-brand-50 rounded-lg mb-3">
              <Heart className="text-brand" size={28} fill="currentColor" />
            </div>
            <h2 className="text-2xl font-bold text-ink mb-2 tracking-tight">
              Become a Founding Contributor
            </h2>
            <p className="text-ink-2 text-sm">
              Two ways in — join the launch waitlist, or set up early-bird UPI
              AutoPay now from ₹10/month.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-card border border-ink/10 rounded-lg">
            <button
              type="button"
              onClick={() => setSubscribeMode("waitlist")}
              className={`py-2 rounded-md text-sm font-semibold transition-colors ${subscribeMode === "waitlist" ? "bg-brand text-white" : "text-ink-2 hover:text-brand"}`}
            >
              Notify me at launch
            </button>
            <button
              type="button"
              onClick={() => setSubscribeMode("autopay")}
              className={`py-2 rounded-md text-sm font-semibold transition-colors ${subscribeMode === "autopay" ? "bg-brand text-white" : "text-ink-2 hover:text-brand"}`}
            >
              Set up AutoPay now
            </button>
          </div>

          {subscribeMode === "waitlist" ? (
            <form className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  className="w-full px-3 py-2 text-sm border border-ink/15 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  className="w-full px-3 py-2 text-sm border border-ink/15 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                  required
                />
              </div>
              <div className="bg-card border-l-4 border-brand rounded-r-lg p-3">
                <div className="flex gap-2">
                  <Bell className="text-brand flex-shrink-0 mt-0.5" size={16} />
                  <div className="text-xs text-ink-2">
                    <p className="font-semibold mb-1 text-ink">
                      No payment yet
                    </p>
                    <p>
                      We'll email you when Season 1 opens at IndiaFOSS 2026
                      (26–27 September), so you can set up UPI AutoPay first.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-700 transition-colors"
              >
                Join the Waitlist
              </button>
              <p className="text-xs text-ink-3 text-center">
                We'll only email you about the launch. No spam.
              </p>
            </form>
          ) : (
            <form className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Your name"
                    className="w-full px-3 py-2 text-sm border border-ink/15 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-2 text-sm border border-ink/15 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="your.email@example.com"
                  className="w-full px-3 py-2 text-sm border border-ink/15 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    PAN Number *
                  </label>
                  <input
                    type="text"
                    placeholder="ABCDE1234F"
                    className="w-full px-3 py-2 text-sm border border-ink/15 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none uppercase font-mono"
                    maxLength={10}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-2 mb-1">
                    Aadhaar Number *
                  </label>
                  <input
                    type="text"
                    placeholder="1234 5678 9012"
                    className="w-full px-3 py-2 text-sm border border-ink/15 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none font-mono"
                    maxLength={14}
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-ink-3">
                Required for statutory compliance. Stored securely, never
                shared.
              </p>

              <div>
                <label className="block text-xs font-semibold text-ink-2 mb-1">
                  Monthly Contribution (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-ink-3 font-medium text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="10"
                    placeholder="100"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-ink/15 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent outline-none font-mono"
                    required
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setAmount("10")}
                    className="px-3 py-1 text-xs font-mono border border-ink/20 rounded-md hover:border-brand hover:text-brand transition-colors"
                  >
                    ₹10
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount("50")}
                    className="px-3 py-1 text-xs font-mono border border-ink/20 rounded-md hover:border-brand hover:text-brand transition-colors"
                  >
                    ₹50
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount("100")}
                    className="px-3 py-1 text-xs font-mono border border-brand bg-brand-50 text-brand-700 rounded-md"
                  >
                    ₹100
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount("500")}
                    className="px-3 py-1 text-xs font-mono border border-ink/20 rounded-md hover:border-brand hover:text-brand transition-colors"
                  >
                    ₹500
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount("1000")}
                    className="px-3 py-1 text-xs font-mono border border-ink/20 rounded-md hover:border-brand hover:text-brand transition-colors"
                  >
                    ₹1000
                  </button>
                </div>
              </div>

              <div className="bg-card border-l-4 border-brand rounded-r-lg p-3">
                <div className="flex gap-2">
                  <AlertCircle
                    className="text-brand flex-shrink-0 mt-0.5"
                    size={16}
                  />
                  <div className="text-xs text-ink-2">
                    <p className="font-semibold mb-1 text-ink">
                      Early-bird UPI AutoPay
                    </p>
                    <p>
                      You'll set up a UPI AutoPay mandate via Razorpay. Your
                      first contribution is collected when Season 1 opens.
                      Cancel anytime.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-card p-3 rounded-lg border border-ink/10 shadow-soft">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-1 w-4 h-4 accent-brand border-ink/20 rounded"
                  required
                />
                <label
                  htmlFor="terms"
                  className="text-xs text-ink-2 leading-relaxed"
                >
                  I agree to authorize The Rupee Fund to process my recurring
                  payment via UPI AutoPay.
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-700 transition-colors"
              >
                Set Up UPI AutoPay
              </button>
              <p className="text-xs text-ink-3 text-center">
                Secured by Razorpay UPI AutoPay · Cancel anytime ·
                Statutory-compliant · India-only
              </p>
            </form>
          )}

          <div className="mt-4 text-center">
            <button
              onClick={() => setCurrentScreen("manage")}
              className="text-xs text-ink-2 hover:text-brand font-medium"
            >
              See what you'll manage → Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProjects = () => (
    <div className="min-h-screen bg-paper">
      {renderHeader()}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-ink mb-2 tracking-tight">
            Where your rupees will go
          </h2>
          <p className="text-sm text-ink-2">
            The Rupee Fund hasn't disbursed yet — Season 1 opens at IndiaFOSS
            2026 (26–27 September, Bengaluru). Here's how funding will work.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-ink/10 shadow-soft p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div>
              <h3 className="text-lg font-bold text-ink mb-1">
                Season 1 — opens at IndiaFOSS 2026
              </h3>
              <p className="text-ink-3 text-xs">
                26–27 September · Bengaluru · be the first rupee
              </p>
            </div>
            <div className="bg-brand-50 px-6 py-3 rounded-lg border border-brand-200">
              <div className="text-xs text-ink-3 mb-1">Pool starts at</div>
              <div className="text-2xl font-mono font-bold text-brand">₹0</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-ink/10 border-dashed p-8 text-center">
          <h3 className="text-lg font-bold text-ink mb-2">
            No disbursements yet
          </h3>
          <p className="text-sm text-ink-2 max-w-xl mx-auto mb-5">
            Founding contributors seed the first pool. Then contributors with
            10+ months of giving vote on which indie Indian FOSS maintainers and
            builders receive funding each season — and disbursements will be
            listed right here, transparently.
          </p>
          <button
            onClick={() => goSubscribe("autopay")}
            className="bg-brand text-white px-6 py-2 rounded-lg font-semibold hover:bg-brand-700 text-sm transition-colors"
          >
            Become a Founding Contributor
          </button>
        </div>

        <div className="mt-8 bg-white rounded-lg p-6 text-center border border-ink/10 border-t-4 border-t-brand">
          <h3 className="text-lg font-bold text-ink mb-2">
            Want to suggest a project?
          </h3>
          <p className="text-sm text-ink-2 mb-4">
            Once you're a contributor with 10+ months, you can vote and suggest
            projects.
          </p>
          <button className="bg-brand text-white px-6 py-2 rounded-lg font-semibold hover:bg-brand-700 text-sm transition-colors">
            Submit Suggestion
          </button>
        </div>
      </div>
    </div>
  );

  const renderManage = () => (
    <div className="min-h-screen bg-paper">
      {renderHeader()}

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg border border-ink/10 shadow-soft p-6">
          <div className="flex items-center justify-center gap-2 mb-6">
            <h2 className="text-2xl font-bold text-ink text-center tracking-tight">
              Manage Subscription
            </h2>
            <span className="rounded-md bg-card border border-ink/15 px-2 py-0.5 text-xs font-mono font-bold uppercase tracking-wider text-ink-3">
              Preview
            </span>
          </div>

          <div className="bg-card border-l-4 border-ink/20 rounded-r-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-ink-3 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-ink text-sm mb-1">
                  No active subscription yet
                </h3>
                <p className="text-xs text-ink-2">
                  This is a preview of what you'll manage once you join. The
                  Rupee Fund launches at IndiaFOSS 2026 (26–27 September).
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6 opacity-60">
            <div className="flex justify-between items-center pb-3 border-b border-ink/10 text-sm">
              <span className="text-ink-2">Monthly Amount</span>
              <span className="font-mono font-semibold text-ink">—</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-ink/10 text-sm">
              <span className="text-ink-2">Next Payment</span>
              <span className="font-mono font-semibold text-ink">—</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-ink/10 text-sm">
              <span className="text-ink-2">Total Contributed</span>
              <span className="font-mono font-semibold text-ink">—</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-ink/10 text-sm">
              <span className="text-ink-2">Voting Status</span>
              <span className="font-semibold text-ink-3">
                Eligible after 10+ months
              </span>
            </div>
          </div>

          <button
            onClick={() => goSubscribe("autopay")}
            className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-700 text-sm transition-colors"
          >
            Become a Founding Contributor
          </button>

          <div className="mt-6 pt-6 border-t border-ink/10">
            <h3 className="font-semibold text-ink mb-3 text-sm">
              Cancelling, once you're subscribed
            </h3>
            <p className="text-xs text-ink-2 mb-3">
              You'll be able to cancel your UPI AutoPay mandate anytime.
              Contributions up to cancellation count toward voting eligibility.
            </p>
            <details className="mb-3">
              <summary className="text-xs text-ink-2 cursor-pointer font-medium">
                How to cancel via UPI
              </summary>
              <div className="mt-2 text-xs text-ink-2 space-y-2 pl-3">
                <p className="font-semibold text-ink">Method 1: UPI App</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Open your UPI app</li>
                  <li>Go to AutoPay/Mandate section</li>
                  <li>Find The Rupee Fund</li>
                  <li>Select Cancel</li>
                </ol>
                <p className="mt-2 font-semibold text-ink">
                  Method 2: Email Link
                </p>
                <p>Request a cancellation link from your subscription email</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {currentScreen === "home" && renderHome()}
      {currentScreen === "subscribe" && renderSubscribe()}
      {currentScreen === "projects" && renderProjects()}
      {currentScreen === "manage" && renderManage()}
    </div>
  );
};

export default RupeeFund;
