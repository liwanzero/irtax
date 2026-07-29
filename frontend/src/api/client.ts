const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.detail || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestForm<T>(path: string, form: FormData, method = "POST"): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method, credentials: "include", body: form });
  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }
  return res.json();
}

async function requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }
  return res.blob();
}

export interface User {
  id: number;
  email: string;
  created_at: string;
  plan_code: string;
  tier_level: number;
  subscription_status: string;
}

export interface Plan {
  id: number;
  code: string;
  name: string;
  price_cents: number;
  tier_level: number;
  monthly_conversion_limit: number | null;
}

export interface ConversionJob {
  id: number;
  direction: "pdf2word" | "word2pdf";
  status: "queued" | "processing" | "done" | "error";
  original_filename: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface PdfEditJob {
  id: number;
  status: string;
  original_filename: string;
  created_at: string;
  updated_at: string;
}

export interface FormField {
  name: string | null;
  type: string | null;
  page: number;
  value: string;
}

export const authApi = {
  config: () => request<{ google_enabled: boolean }>("/auth/config"),
  register: (email: string, password: string) =>
    request<User>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<User>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),
  googleLoginUrl: () => `${API_URL}/auth/google/login`,
};

export const billingApi = {
  config: () => request<{ stripe_enabled: boolean; publishable_key: string }>("/billing/config"),
  plans: () => request<Plan[]>("/billing/plans"),
  checkout: (planId: number) =>
    request<{ url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan_id: planId }),
    }),
  portal: () => request<{ url: string }>("/billing/portal", { method: "POST" }),
};

export const conversionsApi = {
  list: () => request<ConversionJob[]>("/conversions"),
  get: (id: number) => request<ConversionJob>(`/conversions/${id}`),
  create: (direction: "pdf2word" | "word2pdf", file: File): Promise<ConversionJob> => {
    const form = new FormData();
    form.append("direction", direction);
    form.append("file", file);
    return requestForm<ConversionJob>("/conversions", form);
  },
  downloadUrl: (id: number) => `${API_URL}/conversions/${id}/download`,
};

export const editorApi = {
  list: () => request<PdfEditJob[]>("/editor/jobs"),
  createJob: (file: File): Promise<PdfEditJob> => {
    const form = new FormData();
    form.append("file", file);
    return requestForm<PdfEditJob>("/editor/jobs", form);
  },
  preview: (id: number) =>
    request<{ pages: string[]; points_per_pixel: number }>(`/editor/jobs/${id}/preview`),
  formFields: (id: number) => request<FormField[]>(`/editor/jobs/${id}/form-fields`),
  addText: (id: number, payload: { page_number: number; x: number; y: number; text: string; font_size?: number }) =>
    request<PdfEditJob>(`/editor/jobs/${id}/text`, { method: "POST", body: JSON.stringify(payload) }),
  addImage: (
    id: number,
    payload: { page_number: number; x: number; y: number; width: number; height: number },
    file: File
  ): Promise<PdfEditJob> => {
    const form = new FormData();
    form.append("page_number", String(payload.page_number));
    form.append("x", String(payload.x));
    form.append("y", String(payload.y));
    form.append("width", String(payload.width));
    form.append("height", String(payload.height));
    form.append("file", file);
    return requestForm<PdfEditJob>(`/editor/jobs/${id}/image`, form);
  },
  rotate: (id: number, payload: { page_number: number; degrees: number }) =>
    request<PdfEditJob>(`/editor/jobs/${id}/rotate`, { method: "POST", body: JSON.stringify(payload) }),
  merge: (id: number, file: File): Promise<PdfEditJob> => {
    const form = new FormData();
    form.append("file", file);
    return requestForm<PdfEditJob>(`/editor/jobs/${id}/merge`, form);
  },
  split: (id: number, payload: { start_page: number; end_page: number }) =>
    requestBlob(`/editor/jobs/${id}/split`, { method: "POST", body: JSON.stringify(payload) }),
  reorder: (id: number, newOrder: number[]) =>
    request<PdfEditJob>(`/editor/jobs/${id}/reorder`, {
      method: "POST",
      body: JSON.stringify({ new_order: newOrder }),
    }),
  fillForm: (id: number, fields: Record<string, string>) =>
    request<PdfEditJob>(`/editor/jobs/${id}/fill-form`, { method: "POST", body: JSON.stringify({ fields }) }),
  downloadUrl: (id: number) => `${API_URL}/editor/jobs/${id}/download`,
};
