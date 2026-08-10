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

export interface TextSpan {
  text: string;
  font: string;
  size: number;
  color: string;
  bbox: number[];
  origin: number[];
  bold: boolean;
  italic: boolean;
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
  forgotPassword: (email: string) =>
    request<{ ok: boolean }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
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
  textLookup: (id: number, payload: { page_number: number; x: number; y: number }) =>
    request<TextSpan | null>(`/editor/jobs/${id}/text-lookup`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  replaceText: (
    id: number,
    payload: {
      page_number: number;
      bbox: number[];
      origin: number[];
      text: string;
      font_size: number;
      color: string;
      original_font: string;
      bold: boolean;
      italic: boolean;
    }
  ) => request<PdfEditJob>(`/editor/jobs/${id}/replace-text`, { method: "POST", body: JSON.stringify(payload) }),
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
  redact: (id: number, payload: { page_number: number; rect: number[] }) =>
    request<PdfEditJob>(`/editor/jobs/${id}/redact`, { method: "POST", body: JSON.stringify(payload) }),
  downloadUrl: (id: number) => `${API_URL}/editor/jobs/${id}/download`,
};

export interface PageDiff {
  page: number;
  added: string[];
  removed: string[];
}

async function downloadBlobWithFilename(res: Response, fallbackName: string): Promise<void> {
  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface CheckoutAttempt {
  id: number;
  stripe_checkout_session_id: string;
  stripe_subscription_id: string | null;
  stripe_charge_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  three_ds_result: string | null;
  cvc_check: string | null;
  avs_line1_check: string | null;
  avs_postal_check: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface JobUsage {
  kind: "conversion" | "edit";
  id: number;
  original_filename: string;
  status: string;
  created_at: string;
  downloaded_at: string | null;
}

export interface SubscriptionSummary {
  plan_name: string;
  plan_code: string;
  status: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
}

export interface AdminLookup {
  user_id: number;
  email: string;
  created_at: string;
  stripe_customer_id: string | null;
  subscription: SubscriptionSummary | null;
  checkout_attempts: CheckoutAttempt[];
  jobs: JobUsage[];
}

export const adminApi = {
  lookup: (email: string) => request<AdminLookup>(`/admin/lookup?email=${encodeURIComponent(email)}`),
};

export const pdfToolsApi = {
  unlock: async (file: File, password: string): Promise<void> => {
    const form = new FormData();
    form.append("file", file);
    form.append("password", password);
    const res = await fetch(`${API_URL}/editor/tools/unlock`, { method: "POST", credentials: "include", body: form });
    await downloadBlobWithFilename(res, "documento_sin_contrasena.pdf");
  },
  protect: async (file: File, password: string): Promise<void> => {
    const form = new FormData();
    form.append("file", file);
    form.append("password", password);
    const res = await fetch(`${API_URL}/editor/tools/protect`, { method: "POST", credentials: "include", body: form });
    await downloadBlobWithFilename(res, "documento_protegido.pdf");
  },
  compare: (fileA: File, fileB: File): Promise<PageDiff[]> => {
    const form = new FormData();
    form.append("file_a", fileA);
    form.append("file_b", fileB);
    return requestForm<PageDiff[]>("/editor/tools/compare", form);
  },
};
