import axios from 'axios';
import type { ApiErrorDetails, ApiFailure } from '../types/api.types';

/** Turns any thrown value from an API call into a message that is safe to show. */
export function getApiError(error: unknown): ApiErrorDetails {
  if (axios.isAxiosError<ApiFailure>(error)) {
    const apiError = error.response?.data?.error;
    if (apiError) return apiError;
    if (!error.response) {
      return {
        code: 'NETWORK_ERROR',
        message: 'We could not reach the server. Please check your connection and try again.',
      };
    }
  }
  return { code: 'UNKNOWN_ERROR', message: 'Something went wrong. Please try again.' };
}
