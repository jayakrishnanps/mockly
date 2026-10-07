import "server-only";
import { cookies } from "next/headers";
import { isUser, type User } from "./users";

export async function getRememberedUserFromCookies(): Promise<User | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get("mockly_user")?.value;
  return isUser(value) ? value : null;
}
