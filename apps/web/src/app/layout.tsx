import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";

import { getRequestDirection, getRequestLocale } from "@/i18n/locale";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "ContractFlow AI",
  description: "AI operations software for contractors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense>
      <Document>{children}</Document>
    </Suspense>
  );
}

async function Document({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();

  const headerStore = await headers();
  const nonce = headerStore.get("x-nonce") ?? undefined;

  const locale = await getRequestLocale();
  const direction = getRequestDirection(locale);

  return (
    <html lang={locale} dir={direction} suppressHydrationWarning>
      <body>
        <ClerkProvider dynamic>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
            storage="local"
            nonce={nonce}
          >
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
