import { AppShell } from "@/components/navigation/app-shell";
import { ProtectedSessionProvider } from "@/components/auth/protected-session-provider";

export default function ProtectedAppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedSessionProvider>
      <AppShell>{children}</AppShell>
    </ProtectedSessionProvider>
  );
}
