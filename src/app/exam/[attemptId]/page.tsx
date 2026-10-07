import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/mock-validation";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { attemptStore } from "@/server/attempts";
import { AttemptError } from "@/server/attempt-store";
import { ExamClient } from "@/components/exam-client";
import "katex/dist/katex.min.css";
import "@/app/studio/studio.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Exam" };

export default async function ExamPage({ params }: PageProps<"/exam/[attemptId]">) {
  const { attemptId } = await params;
  if (!isUuid(attemptId)) notFound();

  await connection();
  const user = await getRememberedUserFromCookies();
  if (!user) redirect("/");

  let data;
  try {
    data = await attemptStore.getExamData(attemptId, user);
  } catch (error) {
    if (error instanceof AttemptError) {
      if (error.code === "expired") redirect(`/result/${attemptId}`);
      if (error.code === "conflict") redirect(`/result/${attemptId}`);
      if (error.code === "not-found" || error.code === "forbidden") notFound();
    }
    throw error;
  }

  return (
    <ExamClient
      attemptId={data.attemptId}
      mockTitle={data.mockTitle}
      user={data.user}
      expiresAt={data.expiresAt}
      serverNow={data.serverNow}
      revision={data.revision}
      questions={data.questions}
      savedAnswers={data.answers}
    />
  );
}
