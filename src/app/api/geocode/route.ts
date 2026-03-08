import { NextResponse } from "next/server";

type GeocodeRequest = {
  city?: string;
  state?: string;
  street?: string; // optional now, useful later
  country?: string; // optional
};

export async function POST(req: Request) {
  try {
    const key = process.env.GOOGLE_GEOCODING_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Missing GOOGLE_GEOCODING_API_KEY" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as GeocodeRequest;

    const city = (body.city || "").trim();
    const state = (body.state || "").trim();
    const street = (body.street || "").trim();
    const country = (body.country || "USA").trim();

    if (!city || !state) {
      return NextResponse.json(
        { error: "City and State are required for geocoding." },
        { status: 400 }
      );
    }

    const address = [street, city, state, country].filter(Boolean).join(", ");

    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?" +
      new URLSearchParams({
        address,
        key,
      }).toString();

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Geocoding request failed", status: res.status },
        { status: 500 }
      );
    }

    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json(
        {
          ok: false,
          status: data.status,
          error_message: data.error_message,
          address,
        },
        { status: 200 }
      );
    }

    const top = data.results[0];
    const loc = top.geometry?.location;

    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
      return NextResponse.json(
        { ok: false, error: "No lat/lng found", address },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      address,
      formattedAddress: top.formatted_address,
      lat: loc.lat,
      lng: loc.lng,
      placeId: top.place_id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}