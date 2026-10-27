import "server-only";
import { db } from "@/db";
import { createForestStore } from "./forest-store";

export const forestStore = createForestStore(db);
