import { supabase } from "@/lib/supabase";
import type { Customer, DashboardSummary, OrderLine, Product } from "@/types/models";

function sum(values: Array<number | null | undefined>) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

export async function listCustomers(search = ""): Promise<Customer[]> {
  let query = supabase.from("customers").select("*").order("company_name", { ascending: true }).limit(100);
  if (search.trim()) {
    const value = `%${search.trim()}%`;
    query = query.or(`company_name.ilike.${value},name.ilike.${value},email.ilike.${value},phone.ilike.${value},country.ilike.${value}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as Customer[];
}

export async function upsertCustomer(customer: Partial<Customer>) {
  const payload = { ...customer, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("customers").upsert(payload).select("*").single();
  if (error) throw error;
  return data as Customer;
}

export async function listProducts(search = ""): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("id,sku,barcode,name,brand,category,grammage,unit,units_per_carton,kg_per_carton,purchase_price,sale_price,currency,vat_rate,stock_quantity,minimum_stock,active,image_url")
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
  const vat = sum(input.lines.map((line) => line.quantity * line.unit_price * (1 - line.discount_rate / 100) * (line.vat_rate / 100)));
  const total = subtotal + vat;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      customer_id: input.customer_id,
      type: "order",
      status: "draft",
      currency: input.currency,
      exchange_rate: input.exchange_rate,
      subtotal,
      vat_total: vat,
      total,
      notes: input.notes || null
    })
    .select("id")
    .single();

  if (invoiceError) throw invoiceError;

  const items = input.lines.map((line) => ({
    invoice_id: invoice.id,
    product_id: line.product_id || null,
    product_name: line.product_name,
    barcode: line.barcode || null,
    quantity: line.quantity,
    unit_price: line.unit_price,
    discount_rate: line.discount_rate,
    vat_rate: line.vat_rate,
    line_total: line.quantity * line.unit_price * (1 - line.discount_rate / 100)
  }));

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
    supabase.from("invoices").select("id,status,total,created_at").gte("created_at", startOfMonth),
    supabase.from("products").select("id,stock_quantity,minimum_stock").eq("active", true),
    supabase.from("customers").select("id,next_follow_up_at")
  ]);

  for (const result of [orders, invoices, products, customers]) {
    if (result.error) throw result.error;
  }

  const orderRows = orders.data || [];
  const invoiceRows = invoices.data || [];
  const productRows = products.data || [];
  const customerRows = customers.data || [];

  return {
    todaysOrders: orderRows.filter((row: any) => row.created_at >= startOfDay).length,
    pendingOrders: orderRows.filter((row: any) => ["new", "pending", "draft"].includes(row.status)).length,
    invoicedOrders: invoiceRows.filter((row: any) => row.status === "invoiced" || row.status === "paid").length,
    dailySales: sum(invoiceRows.filter((row: any) => row.created_at >= startOfDay).map((row: any) => row.total)),
    monthlySales: sum(invoiceRows.map((row: any) => row.total)),
    receivablesDue: 0,
    lowStockCount: productRows.filter((row: any) => Number(row.stock_quantity || 0) <= Number(row.minimum_stock || 0)).length,
    followUpsDue: customerRows.filter((row: any) => row.next_follow_up_at && row.next_follow_up_at <= today.toISOString()).length
  };
}
