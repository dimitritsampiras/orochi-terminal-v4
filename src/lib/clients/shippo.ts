import { Shippo } from "shippo";
import { env } from "../env";

export const shippo = new Shippo({
  apiKeyHeader: env.SHIPPO_KEY,
});
