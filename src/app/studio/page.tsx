import { redirect } from "next/navigation";
import { getRememberedUserFromCookies } from "@/lib/server-user";

export default async function StudioPage() {
  const user = await getRememberedUserFromCookies();
  redirect(user === "JK" ? "/u/JK/bank" : user ? `/u/${user}` : "/");
}
