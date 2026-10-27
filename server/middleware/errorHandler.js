// Global error handler adhering to PRD shape: { message, code }
const errorHandler = (err, req, res, next) => {
  console.error('[Error caught in middleware]:', err);

  const statusCode = err.statusCode || (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  const code = err.code || (
    statusCode === 400 ? 'VALIDATION_ERROR' :
    statusCode === 401 ? 'UNAUTHORIZED' :
    statusCode === 403 ? 'FORBIDDEN' :
    statusCode === 404 ? 'NOT_FOUND' :
    statusCode === 409 ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR'
  );

  res.status(statusCode).json({
    message: err.message || 'An unexpected error occurred',
    code
  });
};

// Helper custom ApiError class
class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = { errorHandler, ApiError };
