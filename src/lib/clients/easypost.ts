import EasyPost from "@easypost/api";
import { env } from "../env";

export const easypost = new EasyPost(env.EASYPOST_KEY);
