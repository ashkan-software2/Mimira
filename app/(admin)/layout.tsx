import { currentUser } from "@clerk/nextjs/server";
import { AccessDenied } from "../_components/AccessDenied";
import { Shell } from "../_components/Shell";
import { getMemberForUser } from "@/lib/auth";
import {
  countBookings,
  countCustomersNeedingAttention,
  getSettings,
} from "@/lib/repo";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const member = user ? await getMemberForUser(user) : null;
  const blocked = Boolean(user && !member);
  const settings = await getSettings();
  const [inboxCount, bookingCount] = await Promise.all([
    countCustomersNeedingAttention(),
    countBookings(),
  ]);

  if (blocked) {
    return <AccessDenied />;
  }

  return (
    <Shell
      clinicName={settings.clinic.name}
      inboxCount={inboxCount}
      bookingCount={bookingCount}
    >
      {children}
    </Shell>
  );
}
