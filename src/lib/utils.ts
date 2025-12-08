import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(text: string, length: number) {
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

export function debounce<T extends (...args: unknown[]) => unknown>(callback: T, ms = 300) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), ms);
  };
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseGid(gid: string) {
  return gid.split("/").pop();
}

export function buildResourceGid(resource: "Order" | "Product" | "LineItem", id: string) {
  return `gid://shopify/${resource}/${id}`;
}
