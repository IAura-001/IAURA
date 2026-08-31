"use client";
import { useState } from "react";
export default function Beta2FeedbackForm(){const[category,setCategory]=useState("confusing");const[text,setText]=useState("");
 const[rating,setRating]=useState<"yes"|"partly"|"no"|"">("");const[message,setMessage]=useState("");const[busy,setBusy]=useState(false);
 async function submit(){if(busy||(!text.trim()&&!rating))return;setBusy(true);setMessage("");const response=await fetch("/api/beta-feedback",{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"contextual",category,text,rating:rating||null})}).catch(()=>null);
 setMessage(response?.ok?"Feedback saved. Thank you.":"Feedback could not be saved. Please retry or use Support.");setBusy(false);if(response?.ok)setText("");}
 return <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="text-lg font-semibold">Beta 2 feedback</h2>
  <p className="mt-2 text-sm text-zinc-400">Did VAEORA understand what you are trying to build?</p><div className="mt-3 flex gap-2">{(["yes","partly","no"] as const).map(v=><button key={v} type="button" onClick={()=>setRating(v)} aria-pressed={rating===v} className="rounded-lg border border-white/15 px-3 py-2 text-sm capitalize">{v}</button>)}</div>
  <label className="mt-4 block text-sm">What kind of feedback?<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-2 block w-full rounded-lg bg-zinc-900 p-2"><option value="bug">Bug</option><option value="confusing">Confusing</option><option value="missing">Missing something</option><option value="valuable">Valuable</option><option value="other">Other</option></select></label>
  <label className="mt-4 block text-sm">Optional details<textarea value={text} onChange={e=>setText(e.target.value)} maxLength={4000} className="mt-2 min-h-28 w-full rounded-lg bg-zinc-900 p-3" /></label>
  <p className="mt-2 text-xs text-zinc-500">This text is intentional research feedback stored separately from content-free product analytics.</p>
  <button type="button" disabled={busy||(!text.trim()&&!rating)} onClick={()=>void submit()} className="mt-4 rounded-lg border border-violet-300/30 px-4 py-2 text-violet-200 disabled:opacity-40">{busy?"Saving…":"Send feedback"}</button>{message?<p role="status" className="mt-3 text-sm">{message}</p>:null}</section>}
