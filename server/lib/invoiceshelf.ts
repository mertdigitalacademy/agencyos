type InvoiceShelfAuth = {
  token: string;
  companyId?: string;
};

export function getInvoiceShelfBaseUrl(): string {
  return String(process.env.INVOICESHELF_BASE_URL ?? "http://localhost:8090").replace(/\/+$/, "");
}

export function getInvoiceShelfAuth(): InvoiceShelfAuth | null {
  const token = String(process.env.INVOICESHELF_TOKEN ?? "").trim();
  if (!token) return null;
  const companyId = String(process.env.INVOICESHELF_COMPANY_ID ?? "").trim() || undefined;
  return { token, companyId };
}

async function invoiceShelfRequest<T>(path: string, init: RequestInit & { auth?: InvoiceShelfAuth | null }): Promise<T> {
  const baseUrl = getInvoiceShelfBaseUrl();
  const auth = init.auth ?? getInvoiceShelfAuth();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth?.companyId) headers.company = auth.companyId;

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as any) },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`InvoiceShelf API error (${res.status}): ${body.slice(0, 800)}`);
  }

  return (await res.json()) as T;
}

export async function invoiceShelfPing(): Promise<{ success: string }> {
  return invoiceShelfRequest<{ success: string }>("/api/ping", { method: "GET", auth: null });
}

export async function invoiceShelfLogin(params: {
  username: string;
  password: string;
  deviceName?: string;
}): Promise<{ type: string; token: string }> {
  const { username, password, deviceName = "agencyos" } = params;
  return invoiceShelfRequest<{ type: string; token: string }>("/api/v1/auth/login", {
    method: "POST",
    auth: null,
    body: JSON.stringify({ username, password, device_name: deviceName }),
  });
}

export async function invoiceShelfGetInvoiceTemplates(): Promise<Array<{ name: string; custom?: boolean }>> {
  const res = await invoiceShelfRequest<{ invoiceTemplates: Array<{ name: string; custom?: boolean }> }>("/api/v1/invoices/templates", {
    method: "GET",
    auth: undefined,
  });
  return Array.isArray(res.invoiceTemplates) ? res.invoiceTemplates : [];
}

export async function invoiceShelfGetNextInvoiceNumber(): Promise<string> {
  const res = await invoiceShelfRequest<{ success: boolean; nextNumber?: string }>("/api/v1/next-number?key=invoice", {
    method: "GET",
    auth: undefined,
  });
  if (!res.success || !res.nextNumber) throw new Error("InvoiceShelf next-number failed");
  return String(res.nextNumber);
}

export async function invoiceShelfCreateCustomer(params: { name: string; email?: string }): Promise<{ id: number; name: string; email?: string | null }> {
  const res = await invoiceShelfRequest<any>("/api/v1/customers", {
    method: "POST",
    auth: undefined,
    body: JSON.stringify({ name: params.name, email: params.email }),
  });

  const id = Number(res?.id ?? res?.data?.id);
  if (!Number.isFinite(id)) throw new Error("InvoiceShelf customer creation returned invalid id");
  return { id, name: String(res?.name ?? params.name), email: res?.email ?? params.email ?? null };
}

export type InvoiceShelfInvoiceItemInput = {
  name: string;
  description?: string;
  quantity: number;
  price: number;
};

export async function invoiceShelfCreateInvoice(params: {
  customerId: number;
  invoiceNumber: string;
  templateName: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  items: InvoiceShelfInvoiceItemInput[];
}): Promise<any> {
  const subTotal = params.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const total = subTotal;

  const payload = {
    invoice_date: params.invoiceDate,
    due_date: params.dueDate ?? null,
    customer_id: params.customerId,
    invoice_number: params.invoiceNumber,
    discount: 0,
    discount_val: 0,
    sub_total: subTotal,
    total,
    tax: 0,
    template_name: params.templateName,
    items: params.items.map((i) => ({
      name: i.name,
      description: i.description ?? null,
      quantity: i.quantity,
      price: i.price,
    })),
  };

  return invoiceShelfRequest<any>("/api/v1/invoices", { method: "POST", auth: undefined, body: JSON.stringify(payload) });
}

export async function invoiceShelfGetInvoice(invoiceId: number): Promise<any> {
  return invoiceShelfRequest<any>(`/api/v1/invoices/${encodeURIComponent(String(invoiceId))}`, { method: "GET", auth: undefined });
}
