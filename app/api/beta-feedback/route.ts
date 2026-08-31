import { NextResponse } from "next/server";
import { authenticationRequiredResponse,getAuthenticatedUser } from "@/core/auth/session";
import { normalizeBetaFeedback } from "@/core/beta2/feedback";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export async function POST(request:Request){if(!(await getAuthenticatedUser(request)))return authenticationRequiredResponse();
 const feedback=normalizeBetaFeedback(await request.json().catch(()=>null)); if(!feedback)return NextResponse.json({error:"Invalid feedback."},{status:400});
 const supabase=await createServerSupabaseClient(request); const {data,error}=await supabase.rpc("submit_beta_feedback",{
  requested_kind:feedback.kind,requested_category:feedback.category,requested_project_id:feedback.projectId,
  requested_rating:feedback.rating,requested_text:feedback.text,requested_answers:feedback.answers});
 if(error?.code==="42501")return NextResponse.json({error:"Beta cohort membership required."},{status:403});
 if(error)return NextResponse.json({error:"Feedback could not be saved."},{status:503});
 return NextResponse.json({saved:true,id:data},{status:201,headers:{"Cache-Control":"no-store"}});}
