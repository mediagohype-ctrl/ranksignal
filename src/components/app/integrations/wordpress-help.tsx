import { KeyRound } from "lucide-react";

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Sign in to WordPress as an administrator",
    body: "Open your site's dashboard (usually yoursite.com/wp-admin).",
  },
  {
    title: "Go to Users → Profile",
    body: "Or Users → All users, then click the account you want us to use. A dedicated editor account is safest.",
  },
  {
    title: "Find “Application Passwords”",
    body: "Scroll near the bottom of the profile page. Type a name such as the name of this tool, then click “Add New Application Password”.",
  },
  {
    title: "Copy the password WordPress shows you",
    body: "It looks like abcd EFGH 1234 ijkl MNOP 5678. Spaces are fine. WordPress only shows it once.",
  },
  {
    title: "Paste it here with your WordPress username",
    body: "Use the username (not your email) of the same account. We encrypt it and never show it again.",
  },
];

/** Step-by-step guide for creating a WordPress Application Password. */
export function WordPressHelp() {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-small font-semibold text-fg">
        <KeyRound aria-hidden className="size-4 text-primary" />
        How to create an Application Password
      </h3>
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold tabular-nums text-primary-soft-fg"
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-small font-medium text-fg">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </p>
              <p className="text-caption font-normal text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-caption font-normal text-muted">
        Don’t see “Application Passwords”? Your site needs WordPress 5.6 or newer and HTTPS. Some security plugins hide it — check their
        settings. You can revoke the password in the same place at any time.
      </p>
    </div>
  );
}
