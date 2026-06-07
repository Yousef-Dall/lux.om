const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

type RequestOptions = RequestInit & {
  token?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(path: string, params?: RequestOptions['params']) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`, window.location.origin);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return API_BASE_URL ? `${url.pathname}${url.search}` : `${url.pathname}${url.search}`;
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get('content-type');

  if (response.status === 204) {
    return null;
  }

  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, params, headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders);

  if (!headers.has('Content-Type') && requestOptions.body && !(requestOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
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
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : 'Request failed';

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
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
    })
};