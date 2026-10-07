import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { AttemptError } from "@/server/attempt-store";
import { isUuid } from "@/lib/mock-validation";
import { attemptStore } from "@/server/attempts";
import { generateResultTxt, toExportableResult } from "@/lib/export";

export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  if (!isUuid(attemptId)) notFound();

  await connection();
  const user = await getRememberedUserFromCookies();
  if (!user) notFound();
  let data;
  try {
    data = await attemptStore.getResult(attemptId, user);
  } catch (error) {
    if (error instanceof AttemptError && (error.code === "not-found" || error.code === "forbidden")) notFound();
    throw error;
  }
  if (!data) notFound();

  const { mock } = data;
  const textContent = generateResultTxt(toExportableResult(data));
  const filename = `${mock.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_result.txt`;

  return new Response(textContent, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
