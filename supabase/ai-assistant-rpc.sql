CREATE OR REPLACE FUNCTION public.submit_ai_assistant_lead(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r public.ai_assistant_leads;
begin
  if coalesce((payload->>'consent_given')::boolean,false) is not true then raise exception 'Açık rıza gereklidir'; end if;
  if coalesce(payload->>'email','') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then raise exception 'Geçersiz e-posta'; end if;
  if length(regexp_replace(coalesce(payload->>'phone',payload->>'whatsapp',''),'[^0-9]','','g')) < 7 then raise exception 'Geçersiz telefon'; end if;
  if length(coalesce(payload->>'full_name','')) < 2 or length(coalesce(payload->>'company_name','')) < 2 then raise exception 'Ad ve firma gereklidir'; end if;
  insert into public.ai_assistant_leads(
    session_id,conversation_id,language,lead_type,lead_status,priority,source,full_name,company_name,country,city,email,phone,whatsapp,
    preferred_contact_method,product_category,product_name,product_details,quantity,quantity_unit,destination_country,destination_city,
    destination_port,requested_delivery_date,incoterm,target_price,private_label_request,certificate_requirement,logistics_type,message,
    conversation_summary,conversation_json,page_url,referrer,utm_source,utm_medium,utm_campaign,consent_given,contact_captured,duration_seconds,metadata
  ) values (
    left(payload->>'session_id',120),left(payload->>'conversation_id',120),left(coalesce(payload->>'language','en'),5),left(coalesce(payload->>'lead_type','other'),80),
    'new',case when payload->>'priority' in ('low','normal','high','urgent') then payload->>'priority' else 'normal' end,'ai_assistant',
    left(payload->>'full_name',200),left(payload->>'company_name',240),left(payload->>'country',120),left(payload->>'city',120),left(lower(payload->>'email'),320),
    left(payload->>'phone',80),left(payload->>'whatsapp',80),left(payload->>'preferred_contact_method',80),left(payload->>'product_category',200),
    left(payload->>'product_name',500),left(payload->>'product_details',5000),left(payload->>'quantity',120),left(payload->>'quantity_unit',40),
    left(payload->>'destination_country',120),left(payload->>'destination_city',120),left(payload->>'destination_port',160),
    nullif(payload->>'requested_delivery_date','')::date,left(payload->>'incoterm',20),left(payload->>'target_price',120),
    left(payload->>'private_label_request',500),left(payload->>'certificate_requirement',500),left(payload->>'logistics_type',500),
    left(payload->>'message',5000),left(payload->>'conversation_summary',3000),coalesce(payload->'conversation_json','[]'::jsonb),
    left(payload->>'page_url',1000),left(payload->>'referrer',1000),left(payload->>'utm_source',200),left(payload->>'utm_medium',200),
    left(payload->>'utm_campaign',200),true,true,greatest(coalesce((payload->>'duration_seconds')::integer,0),0),coalesce(payload->'metadata','{}'::jsonb)
  ) returning * into r;
  return to_jsonb(r);
end $function$
;
revoke all on function public.submit_ai_assistant_lead(jsonb) from public;
grant execute on function public.submit_ai_assistant_lead(jsonb) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_ai_assistant_event(payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if payload->>'event_name' not in ('opened','message','contact_captured','completed','abandoned') then raise exception 'Geçersiz olay'; end if;
  insert into public.ai_assistant_events(session_id,conversation_id,event_name,language,page_url,utm_source,utm_medium,utm_campaign,duration_seconds)
  values(left(payload->>'session_id',120),left(payload->>'conversation_id',120),payload->>'event_name',left(payload->>'language',5),left(payload->>'page_url',1000),
  left(payload->>'utm_source',200),left(payload->>'utm_medium',200),left(payload->>'utm_campaign',200),greatest(coalesce((payload->>'duration_seconds')::integer,0),0));
end $function$
;
revoke all on function public.record_ai_assistant_event(jsonb) from public;
grant execute on function public.record_ai_assistant_event(jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
