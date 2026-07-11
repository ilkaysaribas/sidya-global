import type { ExchangeRates } from "@/types/models";

const apiBaseUrl = (process.env.EXPO_PUBLIC_API_URL || "https://sidyaglobal.com").replace(/\/$/, "");

export async function authorizedFetch<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.error || data?.message || `İstek başarısız oldu (${response.status}).`;
    throw new Error(message);
  }

  return data as T;
}

export async function fetchExchangeRates(token?: string): Promise<ExchangeRates> {
  const payload = await authorizedFetch<any>("/api/exchange-rates", token);
  const rates = payload?.rates || payload?.data?.rates || payload;
  return {
    source: payload?.source || payload?.data?.source || "TCMB",
    date: payload?.date || payload?.data?.date,
    fetched_at: payload?.fetched_at || payload?.data?.fetched_at,
    rates: {
      USD: Number(rates?.USD || 0),
      EUR: Number(rates?.EUR || 0),
      GBP: Number(rates?.GBP || 0),
      GEL: Number(rates?.GEL || 0),
      RUB: Number(rates?.RUB || 0),
      AED: Number(rates?.AED || 0),
      SAR: Number(rates?.SAR || 0)
    }
  };
}
