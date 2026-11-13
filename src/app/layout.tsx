import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { headers } from "next/headers";
import { Nav } from "@/components/nav";
import { getIdentity } from "../../cursor/identity";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Greenroom · Event CRM",
  description:
    "Comedy booking CRM for contacts, organizations, events, and relative task groups.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const identity = await getIdentity(await headers());

  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {identity.verified ? <Nav /> : null}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
