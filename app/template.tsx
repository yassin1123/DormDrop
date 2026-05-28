/**
 * Page transition. `template.tsx` re-mounts on every navigation (unlike
 * `layout.tsx`), so this wrapper re-runs its enter animation on each route
 * change — a smooth, native-feeling fade + lift. Providers live in the layout
 * above, so context/state survives the transition.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
