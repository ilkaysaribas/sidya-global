create or replace function public.get_public_catalog_products(
  p_search text default null,
  p_limit integer default 48,
  p_offset integer default 0
)
returns table(
  product_id text,
  catalog_id text,
  sku text,
  barcode text,
  name text,
  brand text,
  category text,
  unit text,
  units_per_carton numeric,
  kg_per_carton numeric,
  grammage text,
  sale_price numeric,
  currency text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    p.id::text as product_id,
    coalesce(nullif(p.catalog_id, ''), p.id::text) as catalog_id,
    p.sku,
    p.barcode,
    p.name,
    p.brand,
    p.category,
    p.unit,
    p.units_per_carton,
    p.kg_per_carton,
    p.grammage,
    published.sale_price,
    published.currency,
    count(*) over() as total_count
  from public.products p
  left join lateral (
    select scp.sale_price, scp.currency
    from public.site_catalog_prices scp
    where scp.active = true
      and (
        (p.catalog_id is not null and scp.catalog_id = p.catalog_id)
        or (p.barcode is not null and scp.barcode = p.barcode)
      )
    order by scp.updated_at desc nulls last
    limit 1
  ) published on true
  where p.active is not false
    and (
      nullif(trim(coalesce(p_search, '')), '') is null
      or lower(concat_ws(' ', p.name, p.brand, p.category, p.sku, p.barcode, p.grammage))
         like '%' || lower(trim(p_search)) || '%'
    )
  order by coalesce(p.brand, ''), p.name, p.id
  limit greatest(1, least(coalesce(p_limit, 48), 250))
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

revoke all on function public.get_public_catalog_products(text, integer, integer) from public;
grant execute on function public.get_public_catalog_products(text, integer, integer) to anon, authenticated;
