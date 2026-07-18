import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import React, { useEffect } from "react";
import { ArrowRight, BarChart3, BookOpenText, Keyboard, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getSiteUrl } from "@/lib/siteMetadata";
import { PublicSiteHeader, SITE_FRAME_CLASS, SITE_PAGE_GUTTERS_CLASS, SiteFooter } from "@/components/SiteChrome";

const SITE_URL = getSiteUrl();

const FEATURES = [
  { icon: Keyboard, eyebrow: "Focused practice", title: "Train the writing you actually use", body: "Build speed with formal English, business passages, numbers, symbols, Chinese and code—not filler text." },
  { icon: BarChart3, eyebrow: "Useful feedback", title: "See more than a final score", body: "Review pace, accuracy, consistency and recurring mistakes after every session." },
  { icon: Trophy, eyebrow: "Lasting momentum", title: "Turn repetition into progress", body: "Keep streaks, unlock achievements and compare results without losing sight of accuracy." }
];

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;
    void router.replace("/practice");
  }, [isLoading, router, user]);

  if (user) {
    return (
      <main className="min-h-screen bg-ink-950 text-paper" aria-busy="true">
        <span className="sr-only">Opening practice…</span>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>Typing Station — Deliberate typing practice</title>
        <meta name="description" content="A focused typing practice room for formal English, business writing, Chinese, code, numbers and symbols." />
        <link rel="canonical" href={SITE_URL} />
      </Head>
      <main className="landing-shell min-h-screen overflow-hidden text-paper">
        <div className={`relative z-20 pt-5 ${SITE_PAGE_GUTTERS_CLASS}`}>
          <div className={SITE_FRAME_CLASS}>
          <PublicSiteHeader>
          <nav aria-label="Landing navigation" className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-md px-3 py-2 font-mono text-control text-paper/60 transition hover:bg-paper/10 hover:text-paper sm:block">Log in</Link>
            <Link href="/practice" className="landing-button-secondary">Open practice <ArrowRight className="icon-control" /></Link>
          </nav>
          </PublicSiteHeader>
          </div>
        </div>

        <section className="landing-hero relative mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-7xl items-center gap-14 px-5 pb-20 pt-10 md:px-8 lg:grid-cols-[1.02fr_.98fr] lg:py-20">
          <div className="relative z-10 max-w-3xl">
            <p className="landing-reveal font-mono text-utility uppercase tracking-[0.26em] text-brass">Precision becomes instinct.</p>
            <h1 className="landing-reveal landing-delay-1 mt-6 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Type with purpose.<br /><span className="text-paper/42">Write with pace.</span>
            </h1>
            <p className="landing-reveal landing-delay-2 mt-7 max-w-xl text-lg leading-8 text-paper/58">
              A deliberate practice room for the words, formats and rhythms that show up in real work.
            </p>
            <div className="landing-reveal landing-delay-3 mt-9 flex flex-wrap gap-3">
              <Link href="/practice" className="landing-button-primary">Start a one-minute test <ArrowRight className="icon-control" /></Link>
              <Link href="/training" className="landing-button-secondary"><BookOpenText className="icon-control" /> Explore training</Link>
            </div>
            <p className="landing-reveal landing-delay-3 mt-4 font-mono text-utility uppercase tracking-[0.15em] text-paper/30">No account required to begin</p>
          </div>

          <div className="landing-reveal landing-delay-2 relative mx-auto w-full max-w-xl" aria-label="Typing Station practice preview">
            <div className="landing-practice-card">
              <div className="flex items-center justify-between border-b border-paper/10 pb-4 font-mono text-utility uppercase tracking-[0.18em] text-paper/35">
                <span>Business correspondence</span><span>01:00</span>
              </div>
              <p className="mt-8 font-mono text-xl leading-[2.15] tracking-wide sm:text-2xl">
                <span className="text-emerald-300/85">Please confirm the revised delivery schedule</span><span className="landing-caret"> </span><span className="text-paper/25">before Friday&apos;s review meeting.</span>
              </p>
              <div className="mt-9 grid grid-cols-3 gap-3 border-t border-paper/10 pt-5 font-mono">
                <PreviewStat label="WPM" value="72" /><PreviewStat label="Accuracy" value="98%" /><PreviewStat label="Consistency" value="94%" />
              </div>
            </div>
            <div className="landing-orbit landing-orbit-one" /><div className="landing-orbit landing-orbit-two" />
          </div>
        </section>

        <section className="relative z-10 border-y border-paper/10 bg-ink-900/45">
          <div className="mx-auto grid max-w-7xl md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, eyebrow, title, body }) => (
              <article key={title} className="group border-b border-paper/10 px-6 py-12 transition hover:bg-paper/[0.035] md:border-b-0 md:border-r md:last:border-r-0 lg:px-9">
                <Icon className="icon-prominent text-brass transition-transform duration-300 group-hover:-translate-y-1" />
                <p className="mt-8 font-mono text-utility uppercase tracking-[0.2em] text-paper/35">{eyebrow}</p>
                <h2 className="mt-3 text-section font-semibold tracking-tight">{title}</h2>
                <p className="mt-3 text-body leading-6 text-paper/48">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-24 text-center md:px-8 md:py-32">
          <Sparkles className="icon-prominent mx-auto text-brass" />
          <h2 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">One minute is enough to begin.</h2>
          <p className="mx-auto mt-4 max-w-lg leading-7 text-paper/50">Choose a passage, settle into the rhythm, and let each session show you what to practise next.</p>
          <Link href="/practice" className="landing-button-primary mt-8">Enter the practice room <ArrowRight className="icon-control" /></Link>
        </section>

        <div className={SITE_PAGE_GUTTERS_CLASS}><div className={SITE_FRAME_CLASS}><SiteFooter /></div></div>
      </main>
    </>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-utility uppercase tracking-[0.16em] text-paper/28">{label}</p><p className="mt-2 text-xl text-paper/80">{value}</p></div>;
}
