import { HttpInterceptorFn } from '@angular/common/http';

export const httpInterceptInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req);
};
