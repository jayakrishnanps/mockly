import "server-only";
import { db } from "@/db";
import { createWeakAreaReportStore } from "./weak-area-report-store";

export const weakAreaReportStore = createWeakAreaReportStore(db);
