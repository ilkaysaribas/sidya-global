export type UserRole = "admin" | "sales" | "warehouse" | "accounting";

export type Customer = {
  id: string;
  code?: string | null;
  company?: string | null;
  company_name?: string | null;
  name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  country?: string | null;
  city?: string | null;
  status?: string | null;
  balance?: number | null;
  next_follow_up_at?: string | null;
  notes?: string | null;
};

export type Product = {
  id: string;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  brand?: string | null;
  category?: string | null;
  grammage?: string | null;
  unit?: string | null;
  units_per_carton?: number | null;
  kg_per_carton?: number | null;
  purchase_price?: number | null;
  sale_price?: number | null;
  currency?: string | null;
  vat_rate?: number | null;
  stock_quantity?: number | null;
  minimum_stock?: number | null;
  active?: boolean | null;
  image_url?: string | null;
};

export type OrderStatus = "draft" | "pending" | "approved" | "prepared" | "shipped" | "invoiced" | "cancelled";

export type OrderLine = {
  local_id: string;
  product_id?: string;
  barcode?: string;
  product_name: string;
  grammage?: string | null;
  units_per_carton?: number;
  quantity: number;
  cartons: number;
  unit_price: number;
  discount_rate: number;
  vat_rate: number;
};

export type DashboardSummary = {
  todaysOrders: number;
  pendingOrders: number;
  invoicedOrders: number;
  dailySales: number;
  monthlySales: number;
  receivablesDue: number;
  lowStockCount: number;
  followUpsDue: number;
};

export type ExchangeRates = {
  source: string;
  date?: string;
  fetched_at?: string;
  rates: Record<"USD" | "EUR" | "GBP" | "GEL" | "RUB" | "AED" | "SAR", number>;
};
