import { Beta2FounderAccessError,beta2Csv,getBeta2Dashboard } from "@/core/beta2/server";
export async function GET(){try{return new Response(beta2Csv(await getBeta2Dashboard()),{headers:{"Content-Type":"text/csv; charset=utf-8",
 "Content-Disposition":"attachment; filename=vaeora-beta-2-summary.csv","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}
 catch(error){return Response.json({error:error instanceof Beta2FounderAccessError?"Founder access required.":"Export unavailable."},
 {status:error instanceof Beta2FounderAccessError?403:503});}}
