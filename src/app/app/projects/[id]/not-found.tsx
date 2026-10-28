import { FolderSearch, Plus } from "lucide-react";
import { EmptyState, LinkButton } from "@/components/ui";

export default function ProjectNotFound() {
  return (
    <EmptyState
      size="lg"
      bordered
      icon={<FolderSearch />}
      title="We couldn't find that project"
      description="It may have been deleted, or it belongs to a different workspace. Check the link, or pick a project from your list."
      action={<LinkButton href="/app">Back to projects</LinkButton>}
      secondaryAction={
        <LinkButton href="/app/onboarding" variant="secondary" icon={<Plus />}>
          New project
        </LinkButton>
      }
    />
  );
}
