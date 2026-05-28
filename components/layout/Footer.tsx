import Link from "next/link";
import { Package } from "lucide-react";

/** Site footer with brand mark and basic links. */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="container-page flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <div className="flex items-center gap-2 text-slate-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-900 text-white">
            <Package className="h-4 w-4" />
          </span>
          <span className="font-display font-semibold">DormDrop</span>
          <span className="text-sm text-slate-400">
            · Student delivery, Southampton
          </span>
        </div>

        <nav className="flex items-center gap-5 text-sm text-slate-500">
          <Link href="/requester" className="hover:text-slate-900">
            Order
          </Link>
          <Link href="/runner" className="hover:text-slate-900">
            Deliver
          </Link>
          <Link href="/login" className="hover:text-slate-900">
            Log in
          </Link>
        </nav>

        <p className="text-sm text-slate-400">© {year} DormDrop</p>
      </div>
    </footer>
  );
}
