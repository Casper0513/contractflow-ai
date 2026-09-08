import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { getRequestDirection, getRequestLocale } from "@/i18n/locale";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "ContractFlow AI",
  description: "AI operations software for contractors",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const direction = getRequestDirection(locale);
  return (
    <ClerkProvider>
      <html lang={locale} dir={direction} suppressHydrationWarning>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
            storage="local"
          >
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
