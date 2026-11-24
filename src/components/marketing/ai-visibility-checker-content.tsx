// Body copy for the free AI visibility checker (/tools/ai-visibility-checker): the server-rendered explanation
// below the tool, plus the FAQ items the page renders with QaSection and FAQPage JSON-LD.
import Link from "next/link";
import { Section } from "@/components/marketing/ui";
import type { Qa } from "@/components/marketing/answers";
import { BRAND } from "@/lib/brand";
import { DFY_PLAN, SELF_PLAN, TRIAL_DAYS, aiCheckedLine, gstOn, inr, num } from "@/components/marketing/plans";

const GST = gstOn() ? " + GST" : "";

export const AI_VISIBILITY_FAQ: Qa[] = [
  {
    q: "Is this AI brand mention checker really free?",
    a: (
      <>
        Yes. There is no sign-up and no card. You can run a few checks every hour. Each check asks ChatGPT, Gemini and Perplexity one customer
        question and shows whether they name your business, where you appear in the list and who they name instead.
      </>
    ),
  },
  {
    q: "Why did I get a different result when I checked again?",
    a: (
      <>
        AI answers are not fixed. The same question can get a different list a few minutes later, because the assistant searches the web again and
        writes a new answer each time. One check is a snapshot. To see the real picture, you need many questions asked over several weeks.
      </>
    ),
  },
  {
    q: "How do I track brand mentions in ChatGPT every week?",
    a: (
      <>
        Our {SELF_PLAN.name} plan asks your customer questions for you. {aiCheckedLine(SELF_PLAN.id)}, up to {SELF_PLAN.ai.questionsPerCheck}{" "}
        questions each time, and every answer is saved. It costs {inr(SELF_PLAN.price)} a month{GST}, with a{" "}
        {TRIAL_DAYS}-day free trial. Read our guide on how to{" "}
        <Link href="/learn/track-brand-mentions-in-chatgpt">track brand mentions in ChatGPT</Link>.
      </>
    ),
  },
  {
    q: "My business is not named. What should I do first?",
    a: (
      <>
        Check that AI tools can read your website, that your Google Business Profile is complete, and that your name, address and phone number are
        the same on every listing. Then add pages that answer the questions customers ask. Our{" "}
        <Link href="/free-check">free website check</Link> shows the most important fixes.
      </>
    ),
  },
  {
    q: "Which AI assistants does the checker ask?",
    a: (
      <>
        ChatGPT, Gemini and Perplexity, with web search turned on, so they look things up the way they do for a real customer. Our{" "}
        {DFY_PLAN.name} service can track up to five AI assistants, adding Claude and Grok.
      </>
    ),
  },
  {
    q: "Can you guarantee that ChatGPT will mention my business?",
    a: (
      <>
        No. AI answers are written by other companies&apos; systems, and nobody controls them. Anyone who promises a spot is guessing. We show you what
        the answers say today, help you fix what is missing, and measure honestly whether it changed.
      </>
    ),
  },
];

const linkCls = "[&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline";

export function AiVisibilityCheckerContent() {
  return (
    <Section labelledBy="avc-how">
      <div className={`mx-auto max-w-3xl space-y-5 text-body leading-relaxed text-fg-soft ${linkCls}`}>
        <h2 id="avc-how" className="text-h2 text-fg">
          How the AI visibility checker works
        </h2>
        <p>
          You type your business name and what you do and where, for example &quot;bakery in Indiranagar, Bengaluru&quot;. We turn that into one
          question a real customer might ask, such as &quot;What are the best bakeries in Indiranagar, Bengaluru?&quot;, and ask it to ChatGPT,
          Gemini and Perplexity at the same time.
        </p>
        <p>
          Web search is turned on for each assistant, so they look things up on the internet the way they do when a customer asks. Then we read each
          answer and look for your business name. It usually takes 15–40 seconds, and you don&apos;t need to sign up.
        </p>

        <h2 className="pt-6 text-h2 text-fg">What it checks</h2>
        <p>For each of the three AI assistants, you see:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-fg">Whether you are named.</strong> A simple yes or no: did this answer mention your business?
          </li>
          <li>
            <strong className="text-fg">Your place in the list.</strong> AI assistants often answer with a short list. If you are on it, we show your
            position. Being third in a list of five is very different from being first.
          </li>
          <li>
            <strong className="text-fg">Who is named instead.</strong> The other businesses in the answer. These are the competitors AI assistants
            think of first for your kind of business in your area, and they are not always the ones you expect.
          </li>
        </ul>
        <p>
          Seeing all three side by side is useful on its own. It is common for one assistant to name you while another doesn&apos;t, because each one
          searches the web in its own way and trusts different websites.
        </p>
        <p>
          The free check does not look at your website itself, does not ask more than one question, and only keeps your result for 24 hours (so checking again the same day is instant). It also
          can&apos;t tell you why an assistant chose one business over another. For that, you need to read the full answers over time and compare
          them with what your website and listings say.
        </p>
        <p>
          A tip for reading your result: look at the businesses named instead of you. Open their websites and Google Business Profiles. Do they
          have clearer pages about what they do, more reviews, or mentions on local lists and news sites? Those differences are often the best
          clue to what you should work on first.
        </p>

        <h2 className="pt-6 text-h2 text-fg">Why AI answers change</h2>
        <p>
          If you run the same check twice, you may get a different answer. That is normal, and it is the most important thing to understand about AI
          search.
        </p>
        <p>
          Google shows the same results page to most people searching the same thing at the same time. AI assistants don&apos;t. They write a fresh
          answer every time, and small changes add up: which web pages the search found that minute, how the question was worded, the
          assistant&apos;s own settings, and updates the AI company makes behind the scenes. A business named in one answer can be missing from the
          next.
        </p>
        <p>
          So treat this free check as a snapshot, not a verdict. If you are named, that is a good sign, not a guarantee. If you are not named, it does
          not mean AI assistants never mention you. It means you should look more closely, with more questions, over more weeks.
        </p>

        <h2 className="pt-6 text-h2 text-fg">How to get named more often</h2>
        <p>
          AI assistants name businesses they can find, understand and trust. You can&apos;t control their answers, but you can make it much easier for
          them to choose you:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong className="text-fg">Let AI read your website.</strong> Make sure your site does not block AI search robots, and that each page
            clearly says what you do and where.
          </li>
          <li>
            <strong className="text-fg">Keep your business details the same everywhere.</strong> The same name, address, phone number and hours on
            your website, Google Business Profile and every directory listing. Mixed details make AI unsure which business is which.
          </li>
          <li>
            <strong className="text-fg">Answer the questions customers ask.</strong> Pages that answer &quot;how much does it cost&quot;, &quot;do you
            deliver&quot; or &quot;which is best for…&quot; in plain words are easy for AI to quote.
          </li>
          <li>
            <strong className="text-fg">Be mentioned on other trusted websites.</strong> Reviews, local news, lists of the best businesses in your
            area and industry directories are often where AI assistants look.
          </li>
          <li>
            <strong className="text-fg">Get honest reviews.</strong> AI tools read recent reviews. Many good ones help more than a perfect score with
            only a few.
          </li>
        </ol>
        <p>
          Our guides go into each step: <Link href="/learn/improve-ai-search-visibility">how to improve your AI search visibility</Link>,{" "}
          <Link href="/learn/how-to-get-mentioned-by-chatgpt">how to get mentioned by ChatGPT</Link> and{" "}
          <Link href="/learn/track-brand-mentions-in-chatgpt">how to track brand mentions in ChatGPT</Link>. To see which fixes matter most on your own
          website, run the <Link href="/free-check">free website check</Link>.
        </p>

        <h2 className="pt-6 text-h2 text-fg">Free check vs full tracking</h2>
        <p>
          This free tool asks one question, once, to three AI assistants. It is a quick way to see where you stand today. Because AI answers change,
          one answer can&apos;t tell you whether you are really getting named more or less over time.
        </p>
        <p>
          <Link href="/features/ai-visibility-tracking">Full AI visibility tracking</Link> in {BRAND.name} asks many customer questions, every week,
          and saves every answer so you can read it later. On {SELF_PLAN.name} that is up to {num(SELF_PLAN.ai.answersPerMonth)} AI answers a month.
          You see how often each assistant names you, how often you are named compared with your competitors, which websites the answers link to,
          what they get wrong about your business, and how all of it changes from week to week. Every finding becomes a plain to-do, most important
          first.
        </p>
        <p>
          {SELF_PLAN.name} costs {inr(SELF_PLAN.price)} a month{GST}, with a {TRIAL_DAYS}-day free trial and no card needed. If you would rather our
          team did the work, {DFY_PLAN.name} costs {inr(DFY_PLAN.price)} a month{GST}. Compare both on our{" "}
          <Link href="/pricing">pricing page</Link>.
        </p>
      </div>
    </Section>
  );
}
