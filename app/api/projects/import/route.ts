import { NextResponse } from "next/server";

const headers = {
  "Cache-Control": "no-store",
};

export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy project import is disabled.",
      code: "IAURA_LEGACY_IMPORT_DISABLED",
    },
    {
      status: 410,
      headers,
    },
  );
}
