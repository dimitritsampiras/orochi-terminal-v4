import type { products } from "../../../drizzle/schema";
import { OrderQuery, ProductMediaQueryQuery } from "./admin.generated";

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

export type Order = Extract<NonNullable<OrderQuery["node"]>, { __typename: "Order" }>;
export type MediaImage = Extract<
  NonNullable<ProductMediaQueryQuery["files"]["nodes"][number]>,
  { __typename: "MediaImage" }
>;
