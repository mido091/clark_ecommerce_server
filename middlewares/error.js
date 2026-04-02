export const errorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === "development";

  // Log the error stack for internal debugging (server-side only)
  // Vercel logs will capture these console.error outputs
  console.error(`[ERROR] ${req.method} ${req.path} - ${err.message}`);
  if (isDev || err.status === 500) {
    console.error(err.stack);
  }

  let statusCode = err.status || 500;
  let message = err.message || "Something went wrong on our side!";

  // Handle specific Multer errors
  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File is too large. Maximum size allowed is 1MB for site brand assets.";
    } else {
      message = `Upload error: ${err.message}`;
    }
  } else if (err.message?.includes("Invalid file type")) {
    statusCode = 400;
  }

  // Prevent leaking database schema or raw errors in production
  const errorResponse = {
    success: false,
    message: statusCode === 500 && !isDev ? "An internal server error occurred" : message,
  };

  if (isDev) {
    errorResponse.debug = {
      message: err.message,
      stack: err.stack,
      ...(err.code ? { code: err.code } : {}),
    };
  }

  res.status(statusCode).json(errorResponse);
};
