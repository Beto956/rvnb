import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "RVNB",
  description: "Recreational Vehicle Nationwide Booking",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>

        <Script
          id="google-maps-api"
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&loading=async&v=weekly`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
