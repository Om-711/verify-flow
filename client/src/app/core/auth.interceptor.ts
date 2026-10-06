import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, timeout } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = sessionStorage.getItem('mploychek_token');
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!request.url.startsWith('/api/')) return next(request);
  return next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request).pipe(
    timeout(15000),
    catchError(error => {
      if (error.status === 401 && !request.url.endsWith('/login') && token === sessionStorage.getItem('mploychek_token')) {
        auth.clearSession();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    })
  );
};
