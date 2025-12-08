import type { products } from "../../../drizzle/schema";

export type DataResponse<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: string;
    };
