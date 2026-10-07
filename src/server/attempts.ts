import "server-only";
import { db } from "@/db";
import { createAttemptStore } from "./attempt-store";

export const attemptStore = createAttemptStore(db);
