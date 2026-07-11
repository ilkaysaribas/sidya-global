import { supabase } from "@/lib/supabase";
import type { Customer, DashboardSummary, OrderLine, Product } from "@/types/models";

function sum(values: Array<number | null | undefined>) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

export async function listCustomers(search = ""): Promise<Customer[]> {
  let query = supabase.from("customers").select("*").order("company", { ascending: true }).limit(100);
  if (search.trim()) {
    const value = `%${search.trim()}%`;
    query = query.or(`company.ilike.${value},contact_name.ilike.${value},email.ilike.${value},phone.ilike.${value},country.ilike.${value}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Customer[];
}

export async function upsertCustomer(customer: Partial<Customer>) {
  const payload: Record<string, unknown> = {
    company: customer.company || customer.company_name || customer.name,
    contact_name: customer.contact_name || null,
    email: customer.email || null,
    phone: customer.phone || null,
    country: customer.country || null,
    notes: customer.notes || null,
    status: customer.status || "active",
    updated_at: new Date().toISOString()
  };
  if (customer.id) payload.id = customer.id;
  const { data, error } = await supabase.from("customers").upsert(payload).select("*").single();
  if (error) throw error;
  return data as Customer;
}

export async function listProducts(search = ""): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("brand", { ascending: true })
    .limit(80);

  if (search.trim()) {
    const value = `%${search.trim()}%`;
    query = query.or(`name.ilike.${value},brand.ilike.${value},barcode.ilike.${value},sku.ilike.${value},grammage.ilike.${value}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Product[];
}

export async function findProductByBarcode(barcode: string): Promise<Product | null> {
  const clean = barcode.trim();
  if (!clean) return null;
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .or(`barcode.eq.${clean},sku.eq.${clean},barcode.ilike.%${clean}`)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Product | null;
}

export async function listIncomingOrders(status?: string) {
  let query = supabase.from("site_orders").select("*").order("created_at", { ascending: false }).limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createInvoiceOrder(input: {
  customer_id: string;
  currency: string;
  exchange_rate: number;
  notes?: string;
  lines: OrderLine[];
}) {
  const subtotal = sum(input.lines.map((line) => line.quantity * line.unit_price * (1 - line.discount_rate / 100)));
  const taxTotal = sum(input.lines.map((line) => line.quantity * line.unit_price * (1 - line.discount_rate / 100) * (line.vat_rate / 100)));
  const grandTotal = subtotal + taxTotal;
  const invoiceNo = `MOB-${Date.now()}`;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      invoice_no: invoiceNo,
      invoice_type: "sale",
      customer_id: input.customer_id,
      status: "draft",
      currency: input.currency,
      exchange_rate: input.exchange_rate || 1,
      subtotal,
      tax_total: taxTotal,
      grand_total: grandTotal,
      notes: input.notes || null
    })
    .select("id")
    .single();

  if (invoiceError) throw invoiceError;

  const items = input.lines
    .filter((line) => line.product_id)
    .map((line) => {
      const lineSubtotal = line.quantity * line.unit_price * (1 - line.discount_rate / 100);
      const lineTax = lineSubtotal * (line.vat_rate / 100);
      return {
        invoice_id: invoice.id,
        product_id: line.product_id,
        description: line.product_name,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.vat_rate,
        line_subtotal: lineSubtotal,
        line_tax: lineTax,
        line_total: lineSubtotal + lineTax
      };
    });

  if (!items.length) throw new Error("Fatura kalemi için ürün kartı seçilmelidir.");
  const { error: itemError } = await supabase.from("invoice_items").insert(items);
  if (itemError) throw itemError;
  return invoice.id as string;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [orders, invoices, products, customers] = await Promise.all([
    supabase.from("site_orders").select("id,status,created_at").gte("created_at", startOfMonth),
    supabase.from("invoices").select("id,status,grand_total,created_at").gte("created_at", startOfMonth),
    supabase.from("products").select("id,stock_quantity,minimum_stock").eq("active", true),
    supabase.from("customers").select("id")
  ]);

  for (const result of [orders, invoices, products, customers]) {
    if (result.error) throw result.error;
  }

  const orderRows = orders.data || [];
  const invoiceRows = invoices.data || [];
  const productRows = products.data || [];

  return {
    todaysOrders: orderRows.filter((row: any) => row.created_at >= startOfDay).length,
    pendingOrders: orderRows.filter((row: any) => ["new", "pending", "draft"].includes(row.status)).length,
    invoicedOrders: invoiceRows.filter((row: any) => row.status === "posted").length,
    dailySales: sum(invoiceRows.filter((row: any) => row.created_at >= startOfDay).map((row: any) => row.grand_total)),
    monthlySales: sum(invoiceRows.map((row: any) => row.grand_total)),
    receivablesDue: 0,
    lowStockCount: productRows.filter((row: any) => Number(row.stock_quantity || 0) <= Number(row.minimum_stock || 0)).length,
    followUpsDue: 0
  };
}
