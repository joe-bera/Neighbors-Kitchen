export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorDetails {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorDetails;
}
