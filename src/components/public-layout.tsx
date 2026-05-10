import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

// Single shell for every public-facing page (/, /changelog, /docs).
// Children render between the sticky blurred header and the shared
// footer so all three pages stay visually identical at the chrome
// level.
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
