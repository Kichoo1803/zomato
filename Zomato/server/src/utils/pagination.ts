type PaginationInput = {
  page?: unknown;
  limit?: unknown;
  maxLimit?: number;
};

export const getPagination = ({ page, limit, maxLimit = 50 }: PaginationInput) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.min(maxLimit, Math.max(1, Number(limit) || 12));

  return {
    page: pageNumber,
    limit: limitNumber,
    skip: (pageNumber - 1) * limitNumber,
  };
};

export const getPaginationMeta = ({
  total,
  page,
  limit,
}: {
  total: number;
  page: number;
  limit: number;
}) => ({
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  hasNextPage: page * limit < total,
  hasPreviousPage: page > 1,
});
