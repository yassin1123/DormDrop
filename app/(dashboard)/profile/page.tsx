import { ProfileView } from "@/components/profile/ProfileView";

export const metadata = { title: "Profile" };

// Dynamic so the (dashboard) layout (which reads the session) is never
// statically prerendered at build time.
export const dynamic = "force-dynamic";

export default function ProfilePage() {
  return <ProfileView />;
}
