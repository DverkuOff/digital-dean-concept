import { redirect } from "next/navigation";
import { requireUser } from "@/server/session";

export default async function Home() {
  const user = await requireUser();
  redirect(user.role === "staff" ? "/staff" : "/today");
}
