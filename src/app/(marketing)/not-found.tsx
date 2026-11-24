// 404 for notFound() calls under this root layout (body shared in src/components/shell/not-found-view.tsx).
import { NotFoundView, notFoundMetadata } from "@/components/shell/not-found-view";

export const metadata = notFoundMetadata;

export default function NotFound() {
  return <NotFoundView />;
}
