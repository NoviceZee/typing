import Link from "next/link";
import React from "react";
import { ArrowRight, BookOpenText, Clock3, Gauge, Infinity as InfinityIcon, Keyboard } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageContainer, PageHeader } from "@/components/PageLayout";

const PRIMARY_LINK_CLASS = "ui-focus-ring ui-target-default inline-flex items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-border-selected)] bg-[var(--ui-surface-selected)] px-3 font-mono text-control font-medium text-[color:var(--ui-text-accent)] transition-colors hover:bg-[var(--ui-surface-hover)]";
const SECONDARY_LINK_CLASS = "ui-focus-ring ui-target-default inline-flex items-center justify-center gap-2 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-border-control)] px-3 font-mono text-control font-medium text-[color:var(--ui-text-primary)] transition-colors hover:border-[color:var(--ui-border-strong)] hover:bg-[var(--ui-surface-hover)]";

export default function ChineseTypingPage() {
  return (
    <AppShell topAd={false} sideAd={false}>
      <article lang="zh-Hant">
        <PageContainer className="max-w-5xl py-2 md:py-4">
          <PageHeader
            eyebrow="繁體中文練習"
            title="繁體中文打字練習"
            description="選擇計時或不限時練習，使用你慣用的中文輸入法完成文章；毋須登入即可開始。"
          />

          <div className="flex flex-wrap gap-2">
            <Link href="/practice?language=chinese&mode=1m" className={PRIMARY_LINK_CLASS}>
              開始一分鐘中文練習 <ArrowRight className="icon-control" aria-hidden="true" />
            </Link>
            <Link href="/practice?language=chinese&mode=infinite" className={SECONDARY_LINK_CLASS}>
              開始不限時練習
            </Link>
          </div>

          <div className="mt-8 space-y-8 md:mt-10">
            <section aria-labelledby="chinese-practice-modes">
              <h2 id="chinese-practice-modes" className="text-section font-semibold text-paper">選擇練習方式</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <InfoCard icon={Clock3} title="計時練習">
                  可選一、五或十分鐘，在固定時段內輸入文字，完成後查看速度與準確度。
                </InfoCard>
                <InfoCard icon={InfinityIcon} title="不限時練習">
                  按自己的節奏完成整篇文章，適合先熟習內容、標點和輸入節奏。
                </InfoCard>
              </div>
            </section>

            <section aria-labelledby="chinese-ime" className="border-l-2 border-brass/45 bg-brass/[0.035] px-4 py-4 md:px-5">
              <h2 id="chinese-ime" className="text-section font-semibold text-paper">中文輸入法與組字</h2>
              <p className="mt-2 max-w-3xl text-body leading-7 text-paper/58">
                請先在裝置啟用你慣用的中文輸入法。組字和選字期間，Typing Station 會等待文字確認後才與目標內容比對，避免把尚未確認的內容當成錯誤。
              </p>
              <Link href="/faq#practice" className="mt-3 inline-flex font-mono text-control text-brass transition hover:text-paper">
                查看輸入法常見問題
              </Link>
            </section>

            <section aria-labelledby="chinese-materials">
              <h2 id="chinese-materials" className="text-section font-semibold text-paper">文章練習或集中訓練</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ActionCard icon={BookOpenText} title="中文文章">
                  <p>從生活、工作、教育、科技、文化等分類選擇中文文章，再以計時或不限時模式練習。</p>
                  <Link href="/passages?language=chinese" className={SECONDARY_LINK_CLASS}>瀏覽中文文章</Link>
                </ActionCard>
                <ActionCard icon={Keyboard} title="中文集中訓練">
                  <p>以繁體中文詞語和短語進行計時或詞數練習，並選擇適合的難度。</p>
                  <Link href="/training?content=chinese" className={SECONDARY_LINK_CLASS}>開始中文集中訓練</Link>
                </ActionCard>
              </div>
            </section>

            <section aria-labelledby="chinese-results" className="border-t border-paper/10 pt-6">
              <div className="flex gap-3">
                <Gauge className="icon-prominent mt-0.5 shrink-0 text-brass" aria-hidden="true" />
                <div>
                  <h2 id="chinese-results" className="text-section font-semibold text-paper">完成後可以看到甚麼</h2>
                  <p className="mt-2 max-w-3xl text-body leading-7 text-paper/58">
                    每次完成練習後，可查看輸入速度、準確度、穩定度和錯誤；重複同一內容時，亦可比較上一次結果。
                  </p>
                </div>
              </div>
            </section>
          </div>
        </PageContainer>
      </article>
    </AppShell>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: typeof Clock3; title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-[var(--ui-radius-surface)] border border-[color:var(--ui-border-subtle)] p-4 md:p-5">
      <Icon className="icon-prominent text-brass" aria-hidden="true" />
      <h3 className="mt-3 font-semibold text-paper">{title}</h3>
      <p className="mt-2 text-body leading-7 text-paper/58">{children}</p>
    </article>
  );
}

function ActionCard({ icon: Icon, title, children }: { icon: typeof Clock3; title: string; children: React.ReactNode }) {
  return (
    <article className="flex flex-col items-start rounded-[var(--ui-radius-surface)] border border-[color:var(--ui-border-subtle)] p-4 md:p-5">
      <Icon className="icon-prominent text-brass" aria-hidden="true" />
      <h3 className="mt-3 font-semibold text-paper">{title}</h3>
      <div className="mt-2 flex flex-1 flex-col items-start gap-4 text-body leading-7 text-paper/58">{children}</div>
    </article>
  );
}
