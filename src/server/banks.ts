import "server-only";
import { db } from "@/db";
import { createBankStore } from "./bank-store";

export const bankStore = createBankStore(db);
