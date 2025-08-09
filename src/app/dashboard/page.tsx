import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

export default async function Dashboard() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/");
  }

  return <DashboardClient user={session.user} />;
}