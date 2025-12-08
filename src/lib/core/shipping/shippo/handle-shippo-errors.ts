import { logger } from "../../logger";

import type { SDKError, SDKValidationError } from "shippo/models/errors";

/**
 * Handles Shippo SDK errors and logs them appropriately
 */
export const handleShippoError = (error: unknown, orderId: string, context: string): string => {
  // Check for SDKValidationError (validation/type errors)
  if (error instanceof Error && error.name === "SDKValidationError") {
    const validationError = error as SDKValidationError;
    const errorMessage = validationError.pretty?.() || validationError.message;

    logger.error(`[${context}] Shippo validation error`, {
      category: "SHIPPING",
      orderId,
      metadata: JSON.stringify({
        message: errorMessage,
        rawMessage: validationError.rawMessage,
        cause: validationError.cause,
      }).slice(0, 5000),
    });
    return `${context} Shippo validation error: ${errorMessage}`;
  }

  // Check for SDKError (HTTP/API errors)
  if (error instanceof Error && error.name === "SDKError") {
    const sdkError = error as SDKError;

    // Try to parse and prettify the error body
    let prettifiedBody = "";
    try {
      prettifiedBody = prettifyShippoErrorBody(sdkError.body);
    } catch {
      prettifiedBody = sdkError.body;
    }

    logger.error(`[${context}] Shippo Error: ${prettifiedBody}`, {
      category: "SHIPPING",
      orderId,
      metadata: JSON.stringify({
        body: sdkError.body,
      }).slice(0, 5000),
    });
    return `${context} Shippo error: ${prettifiedBody}`;
  }

  // Handle any other unexpected errors
  logger.error(`[${context}] Unexpected Shippo error`, {
    category: "SHIPPING",
    orderId,
    metadata: JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }).slice(0, 5000),
  });
  return `${context} unexpected Shippo error`;
};

/**
 * Prettifies Shippo API validation error responses
 * Handles nested structures like: {"parcels":[{"weight":["Error message"]}]}
 */
const prettifyShippoErrorBody = (errorBody: unknown, prefix = ""): string => {
  if (typeof errorBody === "string") {
    try {
      // Try to parse if it's a JSON string
      const parsed = JSON.parse(errorBody);
      return prettifyShippoErrorBody(parsed, prefix);
    } catch {
      // If not JSON, return as-is
      return errorBody;
    }
  }

  if (errorBody === null || errorBody === undefined) {
    return "";
  }

  // If it's an array of strings, return them formatted
  if (Array.isArray(errorBody)) {
    if (errorBody.length === 0) return "";

    // Check if it's an array of strings (error messages)
    if (errorBody.every((item) => typeof item === "string")) {
      return errorBody.map((msg) => `  ${prefix}• ${msg}`).join("\n");
    }

    // Otherwise, it's an array of objects (nested structures)
    return errorBody
      .map((item, index) => {
        const itemPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
        return prettifyShippoErrorBody(item, itemPrefix);
      })
      .filter(Boolean)
      .join("\n");
  }

  // If it's an object, process each key-value pair
  if (typeof errorBody === "object") {
    const entries = Object.entries(errorBody);
    if (entries.length === 0) return "";

    return entries
      .map(([key, value]) => {
        const fieldPath = prefix ? `${prefix}.${key}` : key;

        // If value is an array of strings, format as error messages
        if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
          return value.map((msg) => `  ${fieldPath}: ${msg}`).join("\n");
        }

        // Otherwise, recursively process nested structures
        const nested = prettifyShippoErrorBody(value, fieldPath);
        return nested;
      })
      .filter(Boolean)
      .join("\n");
  }

  return String(errorBody);
};
