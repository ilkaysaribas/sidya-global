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