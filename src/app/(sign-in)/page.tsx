import { auth } from "~/server/auth";
import { DashboardClient } from "~/app/_components/dashboard-client";
import Image from "next/image";
import Link from "next/link";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await auth();
  
  if (session?.user) {
    return <DashboardClient user={session.user} />;
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-row items-center gap-2">
            <Image 
              src="airtable_logo.svg"
              alt="logo"
              width={64}
              height={64}
              className=""
            />
            <p className="text-5xl font-semibold">Airtable</p>
          </div>

          <p className="text-lg font-extralight italic">...clone</p>

          <Link
              href="/api/auth/signin" //signout: /api/auth/signout
              className="rounded-full bg-black/40 px-10 py-3 font-semibold no-underline transition hover:bg-black/20 text-white"
          >
              Continue with <b>Google</b>
          </Link>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
