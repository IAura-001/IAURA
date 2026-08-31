import { NextResponse } from "next/server";
import { Beta2FounderAccessError,getBeta2Dashboard } from "@/core/beta2/server";
export async function GET(){try{return NextResponse.json(await getBeta2Dashboard(),{headers:{"Cache-Control":"no-store"}});}
 catch(error){if(error instanceof Beta2FounderAccessError)return NextResponse.json({error:"Founder access required."},{status:403});
 return NextResponse.json({error:"Beta 2 operations unavailable."},{status:503});}}
