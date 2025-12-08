import { drizzle } from "drizzle-orm/postgres-js";
// import postgres from "postgres";
import * as schema from "../../../drizzle/schema";
import { relations } from "../../../drizzle/relations";
import { env } from "../env";

export const db = drizzle(env.DATABASE_URL, { relations, schema });
