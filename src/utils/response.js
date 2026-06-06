const successResponse = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    traceId: res.locals.traceId,
    success: true,
    data
  });
};

const errorResponse = (res, code, message, statusCode = 400, details = null) => {
  const error = { code, message };
  if (details) error.details = details;

  return res.status(statusCode).json({
    traceId: res.locals.traceId,
    success: false,
    error
  });
};

const paginatedResponse = (res, data, total, page, limit) => {
  return res.status(200).json({
    traceId: res.locals.traceId,
    success: true,
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    }
  });
};

export { successResponse, errorResponse, paginatedResponse };
