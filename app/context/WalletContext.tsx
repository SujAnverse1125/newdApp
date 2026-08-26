"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  NetworkType,
  WalletModal,
  WalletProvider as KitWalletProvider,
  WalletType,
  getNativeBalance,
  useWallet as useKitWallet,
} from "stellar-wallet-kit";

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

type WalletState = {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  balance: string;
  selectedWallet: string | null;
  availableWallets: { id: string; name: string; icon: string; installed: boolean }[];
  connect: () => Promise<void>;
  connectWith: (wallet: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
};

const WalletContext = createContext<WalletState | null>(null);

function KitBridge({ children }: { children: React.ReactNode }) {
  const kit = useKitWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [balance, setBalance] = useState("0.00");
  const [balanceLoading, setBalanceLoading] = useState(false);

  const address = kit.account?.address ?? null;

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setBalance("0.00");
      return;
    }
    setBalanceLoading(true);
    try {
      await kit.refreshBalances();
      const value = kit.account?.balances ? getNativeBalance(kit.account.balances) : "0";
      setBalance(Number(value || 0).toFixed(2));
    } catch {
      setBalance("0.00");
    } finally {
      setBalanceLoading(false);
    }
  }, [address, kit]);

  useEffect(() => {
    if (address) void refreshBalance();
  }, [address, refreshBalance]);

  const connect = useCallback(async () => {
    setModalOpen(true);
  }, []);

  const connectWith = useCallback(async (wallet: WalletType) => {
    try {
      await kit.connect(wallet);
      setModalOpen(false);
    } catch {
      // The kit exposes the structured error through kit.error; the app maps it below.
    }
  }, [kit]);

  const error = kit.error
    ? kit.error.message.toLowerCase().includes("reject")
      ? "Your wallet rejected the request. No funds were moved."
      : kit.error.message.toLowerCase().includes("network")
        ? "Network mismatch. Switch your wallet to Stellar Testnet."
        : kit.error.message
    : null;

  const state = useMemo<WalletState>(() => ({
    address,
    isConnected: kit.isConnected,
    isLoading: kit.isConnecting || balanceLoading,
    error,
    balance,
    selectedWallet: kit.selectedWallet,
    availableWallets: kit.availableWallets,
    connect,
    connectWith,
    disconnect: kit.disconnect,
    refreshBalance,
    signTransaction: (xdr) => kit.signTransaction(xdr, {
      network: "TESTNET",
      networkPassphrase: TESTNET_PASSPHRASE,
      accountToSign: address ?? undefined,
    }),
  }), [address, balance, balanceLoading, connect, connectWith, error, kit, refreshBalance]);

  return (
    <WalletContext.Provider value={state}>
      {children}
      <WalletModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        wallets={kit.availableWallets}
        onSelectWallet={(wallet) => void connectWith(wallet)}
        theme={{ mode: "dark", primaryColor: "#6ee7b7", modalBackground: "#111a24", textColor: "#f5f7f2", borderRadius: "18px" }}
        appName="ProofPatch"
      />
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <KitWalletProvider config={{ network: NetworkType.TESTNET, autoConnect: true, appName: "ProofPatch", theme: { mode: "dark" } }}>
      <KitBridge>{children}</KitBridge>
    </KitWalletProvider>
  );
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}

export { TESTNET_PASSPHRASE, WalletType };
