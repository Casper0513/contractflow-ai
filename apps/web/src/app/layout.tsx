import type { Metadata } from "next";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

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
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-slate-950 text-white">
          <header className="border-b border-slate-800 bg-slate-950">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
              <a
                href="/"
                className="text-lg font-bold tracking-tight"
              >
                ContractFlow AI
              </a>

              <div className="flex items-center gap-4">
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-900">
                      Sign in
                    </button>
                  </SignInButton>

                  <SignUpButton mode="modal">
                    <button className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300">
                      Create account
                    </button>
                  </SignUpButton>
                </Show>

                <Show when="signed-in">
                  <a
                    href="/dashboard"
                    className="text-sm text-slate-300 hover:text-white"
                  >
                    Dashboard
                  </a>

                  <UserButton />
                </Show>
              </div>
            </div>
          </header>

          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}