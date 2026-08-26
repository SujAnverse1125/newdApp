# ProofPatch

**Tiny actions. Public proof.**

ProofPatch is a single Stellar Testnet dApp for funding and verifying small community impact missions. Supporters pledge XLM to a defined mission, stewards submit an evidence hash, verifiers approve the proof, and the escrow releases funds while calling a Badge Registry contract to mint a wallet-owned Impact Badge.

> **Testnet only.** This project is an educational challenge submission. Use Freighter, Albedo, WalletConnect, or LOBSTR on Stellar Testnet only. Never enter a seed phrase or private key into the app. Do not use real funds.

## Why this product

Most donation demos stop at “send money.” ProofPatch makes the full trust loop visible: **fund → prove → verify → reward**. That gives the reviewer a memorable real-world use case while demonstrating the required Stellar primitives in one coherent experience.

## Features

| Capability | ProofPatch implementation |
| --- | --- |
| Wallet setup | Stellar Testnet configuration with Stellar Wallet Kit and Freighter compatibility |
| Connect/disconnect | Wallet modal with multiple wallet options and global disconnect state |
| Balance | XLM balance loaded from Horizon for the connected address |
| XLM transaction | User-signed native XLM pledge with pending, success, failure, and explorer receipt states |
| Contract workflow | `ImpactEscrow` mission, pledge, proof, verification, and read methods |
| Inter-contract call | `ImpactEscrow.approve_proof` calls `BadgeRegistry.mint_badge` |
| Real-time activity | `/api/events` reads Soroban RPC contract events; the UI polls and de-duplicates the relay |
| Responsive UX | Editorial desktop layout with mobile breakpoints and a wallet modal designed for narrow screens |
| Testability | Frontend Node tests plus Rust workspace tests and reproducible CI commands |

## Local setup

Prerequisites are Node.js 20+, npm, Rust, Cargo, and the Stellar CLI if you want to deploy the contracts.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure a public Testnet recipient in `NEXT_PUBLIC_PLEDGE_DESTINATION` before attempting a real XLM pledge. The app never handles private keys; signing remains inside the selected wallet.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_HORIZON_URL` | No | Public Horizon Testnet endpoint |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | No | Public Soroban RPC Testnet endpoint |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | After deployment | Escrow contract ID used by the event relay |
| `NEXT_PUBLIC_BADGE_REGISTRY_CONTRACT_ID` | After deployment | Badge contract ID shown in evidence |
| `NEXT_PUBLIC_PLEDGE_DESTINATION` | For payment demo | Funded Testnet public key that receives the demo pledge |

## Contracts

The contracts live under `contracts/` as a Cargo workspace.

```bash
cd contracts
cargo fmt --all
cargo test --workspace
cargo build --workspace --release
```

`impact_escrow` stores the mission lifecycle and escrow amount. `badge_registry` stores the proof badge and only accepts minting from the initialized escrow contract. The intended deployment order is: build both WASM files, deploy `badge_registry`, deploy `impact_escrow`, initialize the registry with the escrow address, then update the public contract IDs in `.env.local`.

The repository does not claim a live contract address or transaction hash until deployment is independently completed on Testnet. After deployment, record the IDs and hashes in `submission/evidence.md` and link each hash to [Stellar Expert Testnet](https://stellar.expert/explorer/testnet).

## Tests and CI

```bash
npm test
npm run typecheck
npm run build
```

GitHub Actions runs the frontend test/typecheck/build job and the Rust format/test/release-build job on pushes and pull requests to `main` or `master`. Add a Vercel deployment workflow only after the repository secrets and live deployment target are available.

## Submission evidence checklist

- [ ] Public GitHub repository URL.
- [ ] Live Vercel or Netlify URL.
- [ ] Screenshot of wallet options available.
- [ ] Screenshot of connected wallet and XLM balance.
- [ ] Screenshot of successful Testnet pledge and explorer receipt.
- [ ] Deployed `ImpactEscrow` and `BadgeRegistry` contract IDs.
- [ ] Verifiable contract-call transaction hash.
- [ ] Screenshot of the responsive mobile UI.
- [ ] Screenshot of CI/CD passing.
- [ ] Screenshot showing at least three passing tests.
- [ ] One-to-two-minute demo video.

## Architecture notes

The frontend uses Next.js App Router, React, and TypeScript. Horizon is used for account balance and native XLM operations. Soroban RPC `getEvents` powers the activity relay. Stellar’s event-ingestion guidance notes that RPC event history is bounded, so a production deployment should persist events through an indexer or ingestion job rather than relying on browser polling alone.

## References

[1]: https://developers.stellar.org/docs/tools/developer-tools/wallets "Stellar wallet integration tools"
[2]: https://developers.stellar.org/docs/build/guides/events/ingest "Ingest events published from a contract"
[3]: https://docs.freighter.app/ "Freighter developer documentation"
[4]: https://stellarwalletskit.dev "Stellar Wallets Kit"
[5]: https://github.com/AmitabhDey-byte/SkillChain_AI "SkillChain AI reference repository"
[6]: https://github.com/SujAnverse1125/NoodleNova "NoodleNova reference repository"
