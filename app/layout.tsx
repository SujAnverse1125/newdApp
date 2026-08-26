import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "./context/WalletContext";

export const metadata: Metadata = {
  title: "ProofPatch — Tiny actions. Public proof.",
  description: "A Stellar Testnet impact-mission network for funding, proving, and rewarding measurable community action.",
  keywords: ["Stellar", "Soroban", "Testnet", "XLM", "impact", "proof", "dApp"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
