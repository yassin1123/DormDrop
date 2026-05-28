import Link from "next/link";
import { Package } from "lucide-react";

/** Centered, branded shell for the login & signup screens. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-12">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 font-display text-xl font-bold text-slate-900"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-900 text-white">
          <Package className="h-5 w-5" />
        </span>
        DormDrop
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
