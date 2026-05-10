import { auth } from "@clerk/nextjs/server";
import { LandingClient } from "@/components/landing-client";
import { PublicLayout } from "@/components/public-layout";

export default async function HomePage() {
  const { userId } = await auth();
  return (
    <PublicLayout>
      <LandingClient isSignedIn={!!userId} />
    </PublicLayout>
  );
}
