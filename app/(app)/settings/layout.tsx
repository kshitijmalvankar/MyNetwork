import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <PageContainer className="max-w-4xl">
      <PageHeader title="Settings" description="Your profile, security and data." />
      <SettingsNav />
      <div className="space-y-6">{children}</div>
    </PageContainer>
  );
}
