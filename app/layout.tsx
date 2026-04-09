import type { Metadata } from "next";
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Trading Terminal",
  description: "Dark AI-powered trading terminal UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-[#0a0a0a] antialiased`}
    >
      <body className="min-h-full bg-[#0a0a0a] text-zinc-100">
        <ClerkProvider>
          <div className="fixed right-3 top-3 z-50 flex items-center gap-2 rounded border border-[#1a1a1a] bg-[#0c0c0c]/95 px-2 py-1 backdrop-blur">
            <Show when="signed-out">
              <SignInButton>
                <button
                  type="button"
                  className="rounded border border-[#2a2a2a] bg-[#141414] px-2 py-1 font-mono text-[11px] text-zinc-300 hover:border-[#3a3a3a]"
                >
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton>
                <button
                  type="button"
                  className="rounded border border-[#1f6b45] bg-[#123523] px-2 py-1 font-mono text-[11px] text-green-300 hover:bg-[#184b30]"
                >
                  Sign Up
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
