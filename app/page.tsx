import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSession();

  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");
  if (session.status === "PENDING_APPROVAL") redirect("/pending");
  if (session.status === "SUSPENDED") redirect("/login");
  redirect("/dashboard");
}
