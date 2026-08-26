import {
  Asset,
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

export const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
export const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const EXPLORER_BASE = "https://stellar.expert/explorer/testnet";

export const horizon = new Horizon.Server(HORIZON_URL);

export function explorerTx(hash: string) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

export function shorten(value: string, chars = 6) {
  return value.length > chars * 2 ? `${value.slice(0, chars)}…${value.slice(-chars)}` : value;
}

export function isValidStellarAddress(address: string) {
  return StrKey.isValidEd25519PublicKey(address);
}

export async function loadNativeBalance(address: string) {
  const account = await horizon.loadAccount(address);
  const native = account.balances.find((entry) => entry.asset_type === "native");
  return Number(native?.balance ?? 0);
}

export async function buildPaymentXdr(source: string, destination: string, amount: string) {
  if (!isValidStellarAddress(destination)) throw new Error("Recipient address is not a valid Stellar public key.");
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error("Enter an XLM amount greater than zero.");
  const account = await horizon.loadAccount(source);
  return new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.payment({ destination, asset: Asset.native(), amount: parsedAmount.toFixed(7) }))
    .setTimeout(180)
    .build()
    .toXDR();
}

export async function submitSignedXdr(signedTxXdr: string) {
  const tx = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  const result = await horizon.submitTransaction(tx as Parameters<typeof horizon.submitTransaction>[0]);
  return result.hash;
}

export type RelayEvent = {
  id: string;
  type: string;
  ledger: number;
  contractId: string;
  topic: string[];
  value: string;
  createdAt: string;
};

export async function readSorobanEvents(startLedger?: number): Promise<RelayEvent[]> {
  const response = await fetch(SOROBAN_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "getEvents",
      params: {
        startLedger: startLedger ?? Math.max(1, Math.floor(Date.now() / 6000) - 1000),
        limit: 20,
        filters: [{ type: "contract", contractIds: [process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID].filter(Boolean) }],
      },
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Soroban relay is temporarily unavailable.");
  const payload = await response.json() as { result?: { events?: { id?: string; type?: string; ledger?: number; contractId?: string; topic?: string[]; value?: string }[] }; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message ?? "Soroban RPC returned an error.");
  return (payload.result?.events ?? []).map((event, index) => ({
    id: event.id ?? `${event.ledger ?? 0}-${index}`,
    type: event.type ?? "contract",
    ledger: event.ledger ?? 0,
    contractId: event.contractId ?? "unknown",
    topic: event.topic ?? [],
    value: event.value ?? "",
    createdAt: new Date().toISOString(),
  }));
}
