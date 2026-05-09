import { auth } from "@clerk/nextjs/server";
import { LandingClient } from "@/components/landing-client";

export default async function HomePage() {
  const { userId } = await auth();
  return <LandingClient isSignedIn={!!userId} />;
}
