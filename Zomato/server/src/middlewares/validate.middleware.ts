import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

type RequestSchema = Partial<{
  body: ZodTypeAny;
  query: ZodTypeAny;
  params: ZodTypeAny;
  cookies: ZodTypeAny;
}>;

export const validate = (schema: RequestSchema): RequestHandler => {
  return (req, _res, next) => {
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }

    if (schema.query) {
      req.query = schema.query.parse(req.query);
    }

    if (schema.params) {
      req.params = schema.params.parse(req.params);
    }

    if (schema.cookies) {
      req.cookies = schema.cookies.parse(req.cookies);
    }

    next();
  };
};
