'use client'

import { LocalConfig } from "../types/misc";

export interface PingResponse {
  status: string;
  message: string;
}

export interface OpenFileBody {
  path: string;
}

export interface OpenFileResponse {
  status: "success" | "error";
  message: string;
  error?: string;
}

export interface FileExistsResponse {
  status: "success" | "error";
  exists: boolean;
  message: string;
  error?: string;
}

export class LocalServerClient {
  private baseUrl: string;

  constructor(config: LocalConfig) {
    this.baseUrl = config.serverUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  // ... (rest of the class methods remain exactly as they were) ...
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // ... implementation ...
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!res.ok) {
        let errorMessage = `Request failed with status ${res.status}`;
        try {
          const errorBody = await res.json();
          if (errorBody.message) {
            errorMessage = errorBody.message;
          }
        } catch (e) {
          // Ignore JSON parse error on failure
          console.log("FILE OPENER ERROR", e);
        }
      }

      return res.json() as Promise<T>;
    } catch (e) {
     
      throw e;
    }
  }

  async ping(): Promise<PingResponse> {
    return this.request<PingResponse>("/ping");
  }

  async open(path: string): Promise<OpenFileResponse> {
    return this.request<OpenFileResponse>("/open", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  }

  async fileExists(path: string): Promise<FileExistsResponse> {
    return this.request<FileExistsResponse>("/exists", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  }
}

export const createLocalClient = (config: LocalConfig) => {
  return new LocalServerClient(config);
};
