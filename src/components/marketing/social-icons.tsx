// Brand marks for the footer's social links (16 × 16, currentColor). X uses the current X logo (not the old Twitter
// bird); YouTube is the play-button mark; Instagram is the official camera glyph. Other sites use lucide icons.
import type { ReactNode } from "react";
import { Facebook, Github, Linkedin } from "lucide-react";

const svg = (children: ReactNode, fill = true) => (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    aria-hidden
    focusable="false"
    fill={fill ? "currentColor" : "none"}
    stroke={fill ? "none" : "currentColor"}
    strokeWidth={fill ? undefined : 2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const XIcon = () =>
  svg(<path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />);

const YouTubeIcon = () =>
  svg(
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />,
  );

const InstagramIcon = () =>
  svg(
    <>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </>,
    false,
  );

/** Icon for a profile's site name (as returned by the footer's profileName), or null to show the name as text. */
export function socialIcon(name: string): ReactNode | null {
  switch (name) {
    case "X":
      return <XIcon />;
    case "YouTube":
      return <YouTubeIcon />;
    case "Instagram":
      return <InstagramIcon />;
    case "LinkedIn":
      return <Linkedin size={16} aria-hidden />;
    case "Facebook":
      return <Facebook size={16} aria-hidden />;
    case "GitHub":
      return <Github size={16} aria-hidden />;
    default:
      return null;
  }
}
