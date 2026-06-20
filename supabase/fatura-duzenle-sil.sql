-- Fatura düzenleme ve silme işlemlerini güvenli biçimde etkinleştirir.
-- Eski faturanın stok ve cari etkisini geri alır.

create or replace function public.delete_invoice_v2(p_invoice_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  invoice_record public.invoices%rowtype;
  item_record public.invoice_items%rowtype;
  current_stock numeric;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz islem';
  end if;

  select * into invoice_record
  from public.invoices
  where id = p_invoice_id
  for update;

  if invoice_record.id is null then
    raise exception 'Fatura bulunamadi';
  end if;

  for item_record in select * from public.invoice_items where invoice_id = p_invoice_id
  loop
    select stock_quantity into current_stock
    from public.products
    where id = item_record.product_id
    for update;

    if invoice_record.invoice_type = 'sale' then
      update public.products
      set stock_quantity = stock_quantity + item_record.stock_quantity, updated_at = now()
      where id = item_record.product_id;
    else
      if current_stock < item_record.stock_quantity then
        raise exception '% urununde fatura silmek icin yeterli stok yok. Mevcut: %, gerekli: %',
          item_record.description, current_stock, item_record.stock_quantity;
      end if;
      update public.products
      set stock_quantity = stock_quantity - item_record.stock_quantity, updated_at = now()
      where id = item_record.product_id;
    end if;
  end loop;

  delete from public.stock_movements
  where reference_type = 'invoice' and reference_id = p_invoice_id;

  delete from public.customer_ledger
  where reference_type = 'invoice' and reference_id = p_invoice_id;

  update public.site_orders
  set status = 'new', converted_invoice_id = null, updated_at = now()
  where converted_invoice_id = p_invoice_id;

  delete from public.invoice_items where invoice_id = p_invoice_id;
  delete from public.invoices where id = p_invoice_id;
  return p_invoice_id;
end;
$$;

grant execute on function public.delete_invoice_v2(uuid) to authenticated;

create or replace function public.replace_invoice_v2(
  p_invoice_id uuid,
  p_invoice_type text,
  p_customer_id uuid,
  p_supplier_id uuid,
  p_source_order_id uuid,
  p_invoice_date date,
  p_due_date date,
  p_currency text,
  p_exchange_rate numeric,
  p_scenario text,
  p_invoice_discount_rate numeric,
  p_notes text,
  p_draft_data jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.delete_invoice_v2(p_invoice_id);
  return public.create_invoice_v2(
    p_invoice_type, p_customer_id, p_supplier_id, p_source_order_id,
    p_invoice_date, p_due_date, p_currency, p_exchange_rate, p_scenario,
    p_invoice_discount_rate, p_notes, p_draft_data, p_items
  );
end;
$$;

grant execute on function public.replace_invoice_v2(
  uuid, text, uuid, uuid, uuid, date, date, text, numeric, text, numeric, text, jsonb, jsonb
) to authenticated;

notify pgrst, 'reload schema';
