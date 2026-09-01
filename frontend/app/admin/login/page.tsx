import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginView } from "@/components/auth/LoginView";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход в DevPrep.",
  robots: { index: false, follow: false },
};

/** Как и админка: nonce из CSP подставляется только при рендере на запрос. */
export const dynamic = "force-dynamic";

export default function LoginPage() {
  // useSearchParams в клиентском компоненте требует Suspense-границы,
  // иначе страница не может быть отрендерена статически.
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
