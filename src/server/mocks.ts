import "server-only";
import { db } from "@/db";
import { createMockStore } from "./mock-store";

export const mockStore = createMockStore(db);
