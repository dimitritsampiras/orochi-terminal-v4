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

export type Pagination = {
  total: number;
  totalPages: number;
  currentPage: number;
};

export interface LocalConfig {
  serverUrl: string;
  arxpFolderPath: string;
}
