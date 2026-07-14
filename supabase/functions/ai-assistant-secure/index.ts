import { createClient } from "jsr:@supabase/supabase-js@2";
const cors={"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type"};
const allowed=new Set(["application/pdf","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/jpeg","image/png","image/webp"]);
const clean=(v,max=500)=>String(v??"").replace(/[<>]/g,"").trim().slice(0,max);
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  try{
    const url=Deno.env.get("SUPABASE_URL")||"";const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    const supplied=String(req.headers.get("apikey")||"");
    const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
    if(!supplied||![anon,key,"sb_publishable_obANQZIOM1xpMIBsJPZcoA__6TGFYBc"].includes(supplied))throw new Error("Yetkisiz istek.");
    const supabase=createClient(url,key,{auth:{persistSession:false}});
    const item=await req.json();const action=clean(item.action,30);
    const crmLead=(row)=>({id:"crm:"+row.id,lead_number:"CRM-"+String(row.id||"").slice(0,6).toUpperCase(),created_at:row.created_at,updated_at:row.updated_at,language:"tr",lead_type:String(row.source||"").includes("quote")?"quote":"contact",lead_status:row.status==="quoted"?"quote_preparing":(["won","lost"].includes(row.status)?row.status:(row.status==="lead"?"new":"contacted")),priority:"normal",source:String(row.source||"").includes("quote")?"quote_form":"contact_form",full_name:row.contact_name,company_name:row.company_name,country:row.country,email:row.email,phone:row.phone,whatsapp:row.whatsapp,product_name:row.interested_products,message:row.notes,conversation_summary:row.notes,conversation_json:[],last_contacted_at:row.last_contact_at,assigned_to:null,converted_to_quote:row.status==="quoted",duration_seconds:0,consent_given:true});
    if(action.startsWith("admin-")){
      const token=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
      const {data:userData,error:userError}=await supabase.auth.getUser(token);
      if(userError||!userData.user)throw new Error("Admin oturumu doğrulanamadı.");
      const {data:admin}=await supabase.from("admin_users").select("user_id").eq("user_id",userData.user.id).maybeSingle();
      if(!admin)throw new Error("Admin yetkisi gerekli.");
      const name=action.slice(6),payload=item.payload||{},query=item.query||{};
      if(name==="list"){
        const [{data:ai,error:ae},{data:crm}]=await Promise.all([supabase.from("ai_assistant_leads").select("*").order("created_at",{ascending:false}).limit(500),supabase.from("crm_customers").select("*").order("created_at",{ascending:false}).limit(500)]);
        if(ae)throw ae;const leads=(ai||[]).concat((crm||[]).map(crmLead)).sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")));
        return new Response(JSON.stringify({ok:true,leads}),{headers:cors});
      }
      if(name==="detail"){
        const id=clean(query.id,90);
        if(id.startsWith("crm:")){
          const cid=id.slice(4);const [{data:row},{data:ints}]=await Promise.all([supabase.from("crm_customers").select("*").eq("id",cid).maybeSingle(),supabase.from("crm_interactions").select("*").eq("customer_id",cid).order("created_at",{ascending:false})]);
          return new Response(JSON.stringify({ok:true,lead:row?crmLead(row):null,files:[],notes:(ints||[]).filter(x=>x.type==="note").map(x=>({note:x.body,created_at:x.created_at}))}),{headers:cors});
        }
        const [{data:lead},{data:files},{data:notes}]=await Promise.all([supabase.from("ai_assistant_leads").select("*").eq("id",id).maybeSingle(),supabase.from("ai_assistant_files").select("*").eq("lead_id",id).order("created_at"),supabase.from("ai_assistant_notes").select("*").eq("lead_id",id).order("created_at",{ascending:false})]);
        return new Response(JSON.stringify({ok:true,lead,files:files||[],notes:notes||[]}),{headers:cors});
      }
      if(name==="update"){
        const id=clean(payload.id,90);
        if(id.startsWith("crm:")){
          const map={new:"lead",contacted:"follow_up_1",quote_preparing:"quoted",won:"won",lost:"lost"};
          const {data,error}=await supabase.from("crm_customers").update({status:map[payload.lead_status]||"lead",last_contact_at:payload.last_contacted_at||null}).eq("id",id.slice(4)).select().single();if(error)throw error;
          return new Response(JSON.stringify({ok:true,lead:crmLead(data)}),{headers:cors});
        }
        const patch={lead_status:clean(payload.lead_status,40),priority:clean(payload.priority,20),assigned_to:payload.assigned_to||null,last_contacted_at:payload.last_contacted_at||null,converted_to_quote:Boolean(payload.converted_to_quote)};
        const {data,error}=await supabase.from("ai_assistant_leads").update(patch).eq("id",id).select().single();if(error)throw error;
        return new Response(JSON.stringify({ok:true,lead:data}),{headers:cors});
      }
      if(name==="note"){
        const id=clean(payload.lead_id,90),note=clean(payload.note,10000);if(!note)throw new Error("Not boş olamaz.");
        if(id.startsWith("crm:")){const {data,error}=await supabase.from("crm_interactions").insert({customer_id:id.slice(4),type:"note",direction:"internal",subject:"AI Asistan ekranı notu",body:note}).select().single();if(error)throw error;return new Response(JSON.stringify({ok:true,note:data}),{headers:cors});}
        const {data,error}=await supabase.from("ai_assistant_notes").insert({lead_id:id,author_id:userData.user.id,note}).select().single();if(error)throw error;return new Response(JSON.stringify({ok:true,note:data}),{headers:cors});
      }
    }
    if(action==="upload"){
      const leadId=clean(item.lead_id,80),sessionId=clean(item.session_id,120),file=item.file||{};
      const {data:lead}=await supabase.from("ai_assistant_leads").select("id,lead_number").eq("id",leadId).eq("session_id",sessionId).maybeSingle();
      if(!lead)throw new Error("Talep kaydı bulunamadı.");
      const mime=clean(file.type,160),name=clean(file.name,180).replace(/[^a-zA-Z0-9._-]/g,"_");
      if(!allowed.has(mime))throw new Error("Bu dosya türüne izin verilmiyor.");
      const raw=String(file.base64||"").replace(/^data:[^;]+;base64,/,"");
      const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));
      if(!bytes.length||bytes.length>3*1024*1024)throw new Error("Dosya boş veya 3 MB sınırını aşıyor.");
      const path=lead.lead_number+"/"+Date.now()+"-"+name;
      const {error:up}=await supabase.storage.from("ai-assistant-attachments").upload(path,bytes,{contentType:mime,upsert:false});
      if(up)throw up;
      const {error:row}=await supabase.from("ai_assistant_files").insert({lead_id:leadId,storage_path:path,original_name:name,mime_type:mime,size_bytes:bytes.length});
      if(row)throw row;
      return new Response(JSON.stringify({ok:true,file:{name,size:bytes.length}}),{headers:cors});
    }
    if(action==="file-url"){
      const token=String(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
      const {data:userData,error:userError}=await supabase.auth.getUser(token);
      if(userError||!userData.user)throw new Error("Admin oturumu doğrulanamadı.");
      const {data:admin}=await supabase.from("admin_users").select("user_id").eq("user_id",userData.user.id).maybeSingle();
      if(!admin)throw new Error("Admin yetkisi gerekli.");
      const {data:file}=await supabase.from("ai_assistant_files").select("*").eq("id",clean(item.id,80)).maybeSingle();
      if(!file)throw new Error("Dosya bulunamadı.");
      const {data:signed,error}=await supabase.storage.from("ai-assistant-attachments").createSignedUrl(file.storage_path,300);
      if(error)throw error;
      return new Response(JSON.stringify({ok:true,url:signed.signedUrl}),{headers:cors});
    }
    throw new Error("İşlem bulunamadı.");
  }catch(error){return new Response(JSON.stringify({ok:false,error:error.message||"İşlem tamamlanamadı."}),{status:400,headers:cors});}
});