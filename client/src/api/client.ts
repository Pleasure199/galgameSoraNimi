import axios from 'axios';
import { translate } from '../i18n/messages';
import { hasAuthHint, refreshAuthenticatedSession } from './authSession';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use(async (request) => {
  if (hasAuthHint()) request.headers.set('X-Auth-Expected', '1');
  else request.headers.delete('X-Auth-Expected');
  return request;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) throw error;
    const config = error.config as (typeof error.config & {
      _authRetried?: boolean;
    }) | undefined;
    const code = String(error.response?.data?.code ?? '');
    if (
      error.response?.status === 401 &&
      (code === 'AUTH_REQUIRED' || code === 'AUTH_EXPIRED') &&
      config &&
      !config._authRetried
    ) {
      config._authRetried = true;
      await refreshAuthenticatedSession();
      return api.request(config);
    }
    throw error;
  }
);

/** 从 axios 错误中取出后端错误码并翻译成文案 */
export function errMsg(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return translate('NETWORK_ERROR');
    const code = String(err.response.data?.code || '');
    return translate(code);
  }
  return translate('INTERNAL_ERROR');
}
