import type { Metadata } from "next";
import { PasswordResetView } from "@/components/auth/PasswordResetView";

export const metadata: Metadata = {
  title: "Восстановление доступа",
  description: "Восстановление доступа к DevPrep.",
  robots: { index: false, follow: false },
};

/** Как и /login: nonce из CSP подставляется только при рендере на запрос. */
export const dynamic = "force-dynamic";

export default function PasswordResetPage() {
  return <PasswordResetView />;
}
