import type { ReactNode } from "react";

// Hindi pages. <html lang="hi"> comes from the Hindi root layout (src/app/(hindi)/layout.tsx); this wrapper only
// keeps the Hindi content marked as Hindi inside the shared (English) header and footer.
export default function HindiLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="hi" className="contents">
      {children}
    </div>
  );
}
