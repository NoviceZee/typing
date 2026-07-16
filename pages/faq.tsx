import React from "react";
import Head from "next/head";
import Link from "next/link";
import { ArrowRight, BarChart3, ChevronDown, Keyboard, ShieldCheck } from "lucide-react";
import { PublicSiteHeader, ReturnToPracticeLink, SITE_FRAME_CLASS, SiteFooter } from "@/components/SiteChrome";

const FAQ_GROUPS = [
  {
    id: "practice",
    number: "01",
    title: "Practice",
    description: "Starting sessions, choosing material and typing on different devices.",
    icon: Keyboard,
    questions: [
      {
        question: "Do I need an account to start typing?",
        answer: "No. You can open Practice or Training and begin immediately. An account is only needed when you want cloud-saved results, a public profile, friends or leaderboard participation."
      },
      {
        question: "What is the difference between Practice and Training?",
        answer: "Practice uses complete passages and is best for rhythm, endurance and realistic writing. Training generates focused drills for words, numbers, symbols, Chinese or code so you can isolate a particular skill."
      },
      {
        question: "How do I start and restart a session?",
        answer: "On a computer, press Tab when the start-with-Tab rule is enabled, then type. On a phone or tablet, tap the typing area and begin. Desktop users can press Tab + Enter to restart and Esc to finish early."
      },
      {
        question: "Does Chinese input work with an IME?",
        answer: "Yes. Typing Station tracks composition and committed Chinese text so candidate selection does not count as a string of mistakes. Choose Chinese in Practice or Training before starting."
      }
    ]
  },
  {
    id: "results",
    number: "02",
    title: "Results",
    description: "Understanding scores, progress and what gets saved.",
    icon: BarChart3,
    questions: [
      {
        question: "What do WPM and accuracy mean?",
        answer: "WPM estimates typing speed from completed characters, while net WPM accounts for mistakes. Accuracy shows how much of your typed input matched the target. The result view also surfaces consistency, timing and recurring errors."
      },
      {
        question: "Where are my results saved?",
        answer: "Anonymous sessions use browser storage. When you are signed in, completed results and private attempt details can sync to your account so progress is available across sessions."
      },
      {
        question: "Why might a result not appear on the leaderboard?",
        answer: "Leaderboards use qualifying results from supported public modes and passages. Private, incomplete, unsupported or ineligible attempts can still remain in your own history without appearing publicly."
      },
      {
        question: "Can I change the typing display and sounds?",
        answer: "Yes. Settings includes themes, fonts, text size, typing width, caret style, colour treatment, behaviour rules and optional keyboard sound packs."
      }
    ]
  },
  {
    id: "account",
    number: "03",
    title: "Account & privacy",
    description: "Public profiles, data controls and getting help.",
    icon: ShieldCheck,
    questions: [
      {
        question: "Is my profile public by default?",
        answer: "Your public-profile setting controls whether other people can open your profile. Only the fields you enable are shown; your email address and private attempt details are not displayed publicly."
      },
      {
        question: "Can I delete my statistics or account?",
        answer: "Yes. Account settings includes separate controls for deleting saved statistics and permanently deleting your account. Read the confirmation carefully because completed deletion cannot be undone."
      },
      {
        question: "How do I report a bug or suggest an improvement?",
        answer: "Use the Feedback link in the footer to open a report. Include the page, what you expected, what happened and clear reproduction steps. Use the private reporting link on the Security page for vulnerabilities."
      }
    ]
  }
] as const;

export default function FaqPage() {
  const questionCount = FAQ_GROUPS.reduce((total, group) => total + group.questions.length, 0);

  return (
    <>
      <Head>
        <title>FAQ — Typing Station</title>
        <meta name="description" content="Answers about Typing Station practice, results, accounts and privacy." />
      </Head>
      <main className="min-h-screen overflow-hidden bg-ink-950 px-5 py-5 text-paper md:px-8">
        <div className="pointer-events-none fixed inset-0" aria-hidden="true">
          <div className="absolute -right-40 -top-52 h-[34rem] w-[34rem] rounded-full border border-brass/10 bg-brass/[0.025]" />
          <div className="absolute -bottom-64 -left-48 h-[38rem] w-[38rem] rounded-full border border-paper/[0.04]" />
        </div>

        <div className={`relative ${SITE_FRAME_CLASS}`}>
          <PublicSiteHeader><ReturnToPracticeLink /></PublicSiteHeader>

          <div className="mx-auto max-w-5xl">
          <section className="grid gap-10 py-12 md:grid-cols-[minmax(0,1fr)_15rem] md:items-end md:py-20">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-brass">Quick answers / {String(questionCount).padStart(2, "0")}</p>
              <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.95] tracking-[-0.045em] md:text-7xl">Find your rhythm.<br /><span className="text-paper/35">Keep moving.</span></h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-paper/55">Straight answers about practising, understanding results and controlling your account—without interrupting a good typing session.</p>
            </div>
            <nav aria-label="FAQ categories" className="border-l border-brass/25 pl-5 font-mono text-xs uppercase tracking-[0.15em] text-paper/40">
              {FAQ_GROUPS.map((group) => <a key={group.id} href={`#${group.id}`} className="flex items-center justify-between border-b border-paper/10 py-3 transition hover:border-brass/35 hover:text-brass"><span>{group.title}</span><span>{group.number}</span></a>)}
            </nav>
          </section>

          <div className="space-y-16 border-t border-paper/10 py-14 md:space-y-24 md:py-20">
            {FAQ_GROUPS.map(({ id, number, title, description, icon: Icon, questions }) => (
              <section id={id} key={id} className="scroll-mt-8 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-12">
                <div className="mb-7 md:mb-0">
                  <Icon className="h-5 w-5 text-brass" aria-hidden="true" />
                  <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/30">Station {number}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
                  <p className="mt-3 text-sm leading-6 text-paper/45">{description}</p>
                </div>
                <div className="border-t border-paper/12">
                  {questions.map(({ question, answer }) => (
                    <details key={question} className="group border-b border-paper/12">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-left text-base font-medium text-paper/80 transition hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass/70 md:py-6">
                        <span>{question}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-brass transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <p className="max-w-2xl pb-6 pr-8 text-sm leading-7 text-paper/52">{answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mb-16 grid gap-6 border border-brass/20 bg-brass/[0.045] p-6 shadow-glow sm:grid-cols-[1fr_auto] sm:items-center md:p-8">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">Still curious?</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">The fastest answer may be one session away.</h2></div>
            <Link href="/practice" className="inline-flex items-center justify-center gap-2 rounded-md bg-brass px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wide text-ink-950 transition hover:bg-paper">Start practising <ArrowRight className="h-4 w-4" /></Link>
          </section>
          </div>

          <SiteFooter />
        </div>
      </main>
    </>
  );
}
