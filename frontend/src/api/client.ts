import { API_BASE_URL } from './assets';

type QueryParamValue = string | number | boolean | null | undefined;

export const SESSION_EXPIRED_EVENT = 'lux:session-expired';

type RequestOptions = RequestInit & {
  token?: string | null;
  params?: Record<string, QueryParamValue>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown = null) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

function buildUrl(path: string, params?: RequestOptions['params']) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const url = API_BASE_URL
    ? new URL(`${API_BASE_URL}${normalizedPath}`)
    : new URL(normalizedPath, window.location.origin);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return API_BASE_URL ? url.toString() : `${url.pathname}${url.search}`;
}

async function parseResponse(response: Response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function getErrorMessage(payload: unknown) {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message;
  }

  return 'Request failed';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, params, headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders);

  const hasBody = requestOptions.body !== undefined && requestOptions.body !== null;
  const isFormData = requestOptions.body instanceof FormData;

  if (!headers.has('Content-Type') && hasBody && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, params), {
    ...requestOptions,
    headers
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401 && token) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(getErrorMessage(payload), response.status, payload);
  }

  return payload as T;
}


async function downloadRequest(
  path: string,
  options: Pick<RequestOptions, 'token' | 'params'> = {},
): Promise<{ blob: Blob; filename: string | null }> {
  const headers = new Headers({ Accept: 'application/octet-stream, application/pdf, image/*' });
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  const response = await fetch(buildUrl(path, options.params), { headers });
  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new ApiError(getErrorMessage(payload), response.status, payload);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  return { blob: await response.blob(), filename: filenameMatch?.[1] ?? null };
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, options),

  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),

  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),

  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body)
    }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'DELETE'
    }),

  upload: <T>(path: string, formData: FormData, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: formData
    }),

  download: (path: string, options?: Pick<RequestOptions, 'token' | 'params'>) =>
    downloadRequest(path, options)
};
