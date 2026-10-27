import "server-only";
import { db } from "@/db";
import { createHEWeakReportStore } from "./he-weak-report-store";

export const heWeakReportStore = createHEWeakReportStore(db);
