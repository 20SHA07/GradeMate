import { AppShell } from "@/components/navigation/app-shell";

export default function ProtectedAppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
