import { logger } from "../../logger";

interface IFieldError {
  field?: string;
  message?: string;
  [key: string]: any;
}

interface EasyPostError {
  code: string;
  message: string;
  errors?: IFieldError[];
}

/**
 * Handles EasyPost SDK errors and logs them appropriately.
 * Simple implementation based on the provided EasyPost error schema.
 */
export const handleEasypostError = (error: unknown, orderId: string, context: string): string => {
  // Check if it's an EasyPost error
  if (isEasyPostError(error)) {
    const { code, message, errors } = error;

    logger.error(`[${context}] EasyPost Error: ${code}`, {
      category: "SHIPPING",
      orderId,
      metadata: JSON.stringify({
        code,
        message,
        errors,
      }).slice(0, 5000),
    });

    let displayMessage = `${context}: ${message}`;

    // Append field errors if available (e.g. "missing required field")
    if (errors && Array.isArray(errors) && errors.length > 0) {
      const fieldErrors = errors
        .map((e) => {
          if (e.field && e.message) return `${e.field}: ${e.message}`;
          if (e.message) return e.message;
          return JSON.stringify(e);
        })
        .join(", ");
      displayMessage += ` (${fieldErrors})`;
    }

    return displayMessage;
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    logger.error(`[${context}] Unexpected EasyPost error`, {
      category: "SHIPPING",
      orderId,
      metadata: JSON.stringify({
        message: error.message,
        stack: error.stack,
      }).slice(0, 5000),
    });
    return `${context}: ${error.message}`;
  }

  // Handle other unknown errors
  const errorMessage = String(error);
  logger.error(`[${context}] Unknown EasyPost error`, {
    category: "SHIPPING",
    orderId,
    metadata: errorMessage,
  });
  return `${context}: ${errorMessage}`;
};

function isEasyPostError(error: any): error is EasyPostError {
  return error && typeof error === "object" && "code" in error && "message" in error;
}
