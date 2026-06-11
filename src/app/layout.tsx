import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";
import "./globals.css";
import TopAppBar from "../components/TopAppBar";
import NavigationDrawer from "../components/NavigationDrawer";
import MobileNavBar from "../components/MobileNavBar";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VectoPath - Ecosystem Dashboard",
  description: "Autonomous Career Orchestrator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geist.variable} ${inter.variable}`}
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="text-on-surface antialiased font-body-md min-h-screen flex flex-col md:flex-row pb-20 md:pb-0 overflow-x-hidden selection:bg-primary-fixed-dim selection:text-surface-lowest bg-background">
        <TopAppBar />
        <NavigationDrawer />
        <main className="pt-24 pb-32 md:pb-24 md:pl-[304px] px-container-padding max-w-[1440px] mx-auto min-h-screen flex flex-col gap-stack-lg w-full">
          {children}
        </main>
        <MobileNavBar />
      </body>
    </html>
  );
}
