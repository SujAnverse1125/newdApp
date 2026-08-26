"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useWallet, WalletType } from "./context/WalletContext";
import { buildPaymentXdr, explorerTx, readSorobanEvents, shorten, submitSignedXdr, type RelayEvent } from "../lib/stellar";

type Mission = {
  id: number;
  title: string;
  category: string;
  location: string;
  steward: string;
  pledged: number;
  target: number;
  supporters: number;
  days: number;
  accent: string;
  blurb: string;
};

const missions: Mission[] = [
  { id: 204, title: "Shade the bus stop", category: "ACCESS", location: "Kolkata · Ward 11", steward: "GDD…7K2P", pledged: 18.4, target: 30, supporters: 12, days: 6, accent: "mint", blurb: "Fund a reflective canopy and make the noon wait safer for 60 daily riders." },
  { id: 205, title: "Restore the rain garden", category: "CLIMATE", location: "Pune · Aundh", steward: "GBQ…P0F8", pledged: 42.8, target: 50, supporters: 27, days: 3, accent: "violet", blurb: "Replant a storm-water pocket that keeps 8,000L of runoff out of the street." },
  { id: 206, title: "Stock the night pantry", category: "CARE", location: "Bengaluru · Indiranagar", steward: "GCX…M1AA", pledged: 9.2, target: 20, supporters: 8, days: 11, accent: "orange", blurb: "A transparent weekly staple run for night-shift workers and neighbors in need." },
];

const badgeNames = ["First proof", "Rainmaker", "Street signal"];

function Icon({ name, size = 18 }: { name: "arrow" | "spark" | "link" | "wallet" | "pulse" | "shield" | "plus" | "check" | "copy"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "arrow") return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === "link") return <svg {...common}><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 7 20l1.1-1.1" /></svg>;
  if (name === "wallet") return <svg {...common}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5v-9Z" /><path d="M3 8h15a3 3 0 0 1 3 3v1h-4a2 2 0 1 0 0 4h4" /></svg>;
  if (name === "pulse") return <svg {...common}><path d="M3 12h4l2.5-7 5 14 2.5-7H21" /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 20 6v5c0 5-3.3 8.4-8 10-4.7-1.6-8-5-8-10V6l8-3Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
  if (name === "copy") return <svg {...common}><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
  return <svg {...common}><path d="M12 3 14.6 9l6.4.6-4.8 4.2 1.5 6.2-5.7-3.3-5.7 3.3 1.5-6.2-4.8-4.2L9.4 9 12 3Z" /></svg>;
}

function Progress({ value, target }: { value: number; target: number }) {
  return <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, (value / target) * 100)}%` }} /></div>;
}

export default function HomePage() {
  const wallet = useWallet();
  const [activeMission, setActiveMission] = useState<Mission>(missions[0]);
  const [amount, setAmount] = useState("3");
  const [recipient, setRecipient] = useState(process.env.NEXT_PUBLIC_PLEDGE_DESTINATION ?? "");
  const [txState, setTxState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [txMessage, setTxMessage] = useState("");
  const [proofHash, setProofHash] = useState("");
  const [proofState, setProofState] = useState<"idle" | "pending" | "success">("idle");
  const [relayEvents, setRelayEvents] = useState<RelayEvent[]>([]);
  const [relayError, setRelayError] = useState("");
  const [walletPanelOpen, setWalletPanelOpen] = useState(false);

  const progress = useMemo(() => Math.round((activeMission.pledged / activeMission.target) * 100), [activeMission]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/events", { cache: "no-store" });
        const data = await response.json() as { events?: RelayEvent[]; error?: string };
        if (!cancelled && data.events) setRelayEvents(data.events);
        if (!cancelled && data.error) setRelayError(data.error);
      } catch {
        if (!cancelled) setRelayError("Relay is waiting for the contract address.");
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  async function handlePledge(event: FormEvent) {
    event.preventDefault();
    setTxState("pending");
    setTxHash("");
    setTxMessage("");
    try {
      if (!wallet.address) throw new Error("Connect a Stellar wallet before pledging.");
      if (!recipient) throw new Error("Add a Testnet recipient in the pledge form or configure NEXT_PUBLIC_PLEDGE_DESTINATION.");
      const xdr = await buildPaymentXdr(wallet.address, recipient, amount);
      const signed = await wallet.signTransaction(xdr);
      const hash = await submitSignedXdr(signed.signedTxXdr);
      setTxHash(hash);
      setTxState("success");
      setTxMessage(`Pledge confirmed for ${activeMission.title}.`);
    } catch (error) {
      setTxState("error");
      setTxMessage(error instanceof Error ? error.message : "The pledge could not be submitted.");
    }
  }

  function submitProof(event: FormEvent) {
    event.preventDefault();
    if (!proofHash.trim()) return;
    setProofState("pending");
    window.setTimeout(() => setProofState("success"), 700);
  }

  const connectLabel = wallet.isConnected && wallet.address ? shorten(wallet.address) : "Connect wallet";

  return (
    <main>
      <div className="topline"><span><i className="live-dot" /> Stellar Testnet</span><span>ProofPatch beta · tiny actions, public proof</span><span className="topline-right">Non-custodial <span className="dot-sep">·</span> no real XLM</span></div>
      <nav className="nav-shell">
        <a className="logo" href="#top"><span className="logo-mark"><Icon name="spark" size={17} /></span><span><strong>ProofPatch</strong><small>impact relay</small></span></a>
        <div className="nav-links"><a href="#missions">Discover</a><a href="#how">How it works</a><a href="#relay">Live relay</a></div>
        <div className="nav-actions"><button className="network-pill"><span className="network-icon" /> Testnet</button><button className="connect-button" onClick={() => setWalletPanelOpen(true)}><Icon name="wallet" size={16} /> {connectLabel}</button></div>
      </nav>

      <section className="hero-shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> ON-CHAIN IMPACT MISSIONS</div>
          <h1>Make good <em>visible.</em></h1>
          <p className="hero-lede">ProofPatch turns small community actions into transparent missions. Fund the work, verify the proof, and let Stellar carry the receipt.</p>
          <div className="hero-actions"><a className="primary-cta" href="#missions">Explore missions <Icon name="arrow" size={16} /></a><a className="secondary-cta" href="#how"><span className="play-orb"><Icon name="arrow" size={12} /></span> See how it works</a></div>
          <div className="hero-note"><Icon name="shield" size={16} /> <span><strong>Wallet-owned proof.</strong> Your keys never leave your wallet.</span></div>
        </div>
        <div className="hero-art" aria-label="ProofPatch mission illustration">
          <div className="hero-grid" />
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="hero-card hero-card-main"><div className="mini-label">MISSION 204 <span className="live-label"><i className="live-dot" /> LIVE</span></div><h3>Shade the bus stop</h3><p>Make the noon wait safer for 60 daily riders.</p><div className="hero-card-bottom"><div><span>Funded</span><strong>18.4 <small>XLM</small></strong></div><div className="hero-sparkline"><span /><span /><span /><span /><span /><span /><span /></div></div></div>
          <div className="hero-badge"><span className="badge-star"><Icon name="spark" size={16} /></span><div><small>PROOF VERIFIED</small><strong>impact badge #18</strong></div></div>
          <div className="hero-coordinate">22.5726° N<br /><span>88.3639° E</span></div>
          <div className="hero-stamp">PROOF<br /><b>PATCH</b></div>
        </div>
      </section>

      <section className="signal-strip"><div><span className="signal-number">42</span><span className="signal-label">active missions</span></div><div><span className="signal-number">318.6</span><span className="signal-label">XLM pledged</span></div><div><span className="signal-number">87</span><span className="signal-label">proofs verified</span></div><div className="signal-last"><span className="signal-pulse"><Icon name="pulse" size={16} /></span><span><strong>relay healthy</strong><small>events syncing every 8s</small></span></div></section>

      <section className="section-shell" id="missions">
        <div className="section-kicker"><span>01 / THE PATCHBOARD</span><span>Every mission has a receipt <Icon name="arrow" size={14} /></span></div>
        <div className="section-heading"><div><h2>Fund what should<br /><em>exist tomorrow.</em></h2></div><p>Choose a small, concrete action. Your pledge becomes part of a public trail — not a black box.</p></div>
        <div className="mission-grid">{missions.map((mission) => <article className={`mission-card ${mission.accent}`} key={mission.id}><div className="mission-top"><span className="category">{mission.category}</span><span className="mission-id">#{mission.id}</span></div><div className="mission-icon"><span className="icon-ring"><Icon name={mission.category === "CLIMATE" ? "spark" : mission.category === "CARE" ? "shield" : "plus"} size={19} /></span><span className="pin-dot" /></div><h3>{mission.title}</h3><p>{mission.blurb}</p><div className="mission-meta"><span>{mission.location}</span><span>{mission.days} days left</span></div><Progress value={mission.pledged} target={mission.target} /><div className="mission-footer"><span><strong>{mission.pledged}</strong> / {mission.target} XLM</span><span>{mission.supporters} supporters</span></div><button className="mission-link" onClick={() => { setActiveMission(mission); document.getElementById("pledge")?.scrollIntoView({ behavior: "smooth" }); }}>View mission <Icon name="arrow" size={14} /></button></article>)}</div>
      </section>

      <section className="workbench-shell" id="pledge">
        <div className="workbench-intro"><div className="section-kicker"><span>02 / THE WORKBENCH</span><span className="kicker-status"><i className="live-dot" /> TESTNET ONLY</span></div><h2>Put your XLM<br /><em>where your values are.</em></h2><p>Connect a wallet, pick a patch, and make a pledge. ProofPatch keeps the funding action legible from first click to explorer receipt.</p><div className="selected-mission"><span className="selected-icon"><Icon name="spark" size={17} /></span><div><small>SELECTED MISSION</small><strong>{activeMission.title}</strong><span>{activeMission.location} · {activeMission.category}</span></div><span className="selected-progress">{progress}%</span></div></div>
        <div className="pledge-panel"><div className="panel-title"><span><span className="step-number">01</span> Pledge XLM</span><span className="panel-tag">USER-SIGNED</span></div><form onSubmit={handlePledge}><label>Amount <span>Available: {wallet.balance} XLM</span></label><div className="amount-wrap"><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" aria-label="Pledge amount" /><b>XLM</b></div><div className="quick-amounts">{["1", "3", "5", "10"].map((value) => <button type="button" key={value} onClick={() => setAmount(value)} className={amount === value ? "active" : ""}>{value}</button>)}</div><label>Testnet recipient <span>required for a real payment</span></label><input className="recipient-input" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="G… recipient address" /><button className="submit-button" type="submit" disabled={txState === "pending"}>{txState === "pending" ? "Waiting for wallet…" : <><Icon name="wallet" size={16} /> Connect & pledge</>}</button></form>{txState !== "idle" && <div className={`transaction-result ${txState}`}><span className="result-icon">{txState === "success" ? <Icon name="check" size={15} /> : txState === "pending" ? <span className="spinner" /> : "!"}</span><div><strong>{txState === "success" ? "Pledge confirmed" : txState === "pending" ? "Transaction pending" : "Pledge needs attention"}</strong><span>{txMessage}</span>{txHash && <a href={explorerTx(txHash)} target="_blank" rel="noreferrer">View Stellar receipt <Icon name="arrow" size={12} /></a>}</div></div>}</div>
      </section>

      <section className="how-shell" id="how"><div className="section-kicker"><span>03 / THE PROTOCOL</span><span>Four states. One shared receipt.</span></div><div className="how-heading"><h2>Good work has<br /><em>a lifecycle.</em></h2><p>ProofPatch makes the “before” and “after” equally easy to see. No opaque donation buckets — only state changes you can follow.</p></div><div className="lifecycle"><div className="life-line" /><div className="life-step"><span className="life-number">01</span><span className="life-icon"><Icon name="plus" size={20} /></span><h3>Fund</h3><p>Supporters pledge XLM to a defined mission.</p><span className="life-event">PLEDGE_CREATED</span></div><div className="life-step"><span className="life-number">02</span><span className="life-icon"><Icon name="link" size={20} /></span><h3>Prove</h3><p>A steward submits a hash of the work evidence.</p><span className="life-event">PROOF_SUBMITTED</span></div><div className="life-step"><span className="life-number">03</span><span className="life-icon"><Icon name="shield" size={20} /></span><h3>Verify</h3><p>A verifier checks the evidence and approves it.</p><span className="life-event">PROOF_VERIFIED</span></div><div className="life-step"><span className="life-number">04</span><span className="life-icon"><Icon name="spark" size={20} /></span><h3>Reward</h3><p>Escrow releases funds and mints a proof badge.</p><span className="life-event">BADGE_MINTED</span></div></div></section>

      <section className="proof-shell"><div className="proof-copy"><div className="section-kicker"><span>04 / THE PROOF DESK</span><span>Steward view</span></div><h2>Your action.<br /><em>On record.</em></h2><p>Every patch ends with an artifact. Paste an IPFS, Arweave, or HTTPS evidence hash to start a reviewable proof trail.</p><form onSubmit={submitProof}><label>Evidence hash or URI</label><div className="proof-input-wrap"><Icon name="link" size={17} /><input value={proofHash} onChange={(event) => setProofHash(event.target.value)} placeholder="ipfs://… or https://…" /><button type="submit" disabled={proofState === "pending"}>{proofState === "pending" ? "Saving" : <Icon name="arrow" size={15} />}</button></div></form>{proofState === "success" && <div className="proof-success"><Icon name="check" size={15} /> Proof staged for verifier review</div>}</div><div className="proof-card"><div className="proof-card-top"><span className="proof-mini-label">PATCH RECEIPT</span><span className="verified-pill"><Icon name="check" size={11} /> VERIFIED</span></div><div className="proof-visual"><div className="proof-orb"><Icon name="spark" size={28} /></div><span className="proof-ray ray-a" /><span className="proof-ray ray-b" /><span className="proof-ray ray-c" /></div><div className="proof-details"><span>Impact Badge #018</span><strong>Rain garden restored</strong><small>Proof hash <b>QmX…9aE</b> · ledger 5,812,044</small></div></div></section>

      <section className="relay-shell" id="relay"><div className="relay-header"><div><div className="section-kicker"><span>05 / THE LIVE RELAY</span><span className="kicker-status"><i className="live-dot" /> RPC STREAM</span></div><h2>Watch the proof<br /><em>move in real time.</em></h2></div><div className="relay-explainer"><span className="relay-wave"><Icon name="pulse" size={18} /></span><p>Soroban events are polled, de-duplicated, and shown as a public activity trail.</p></div></div><div className="relay-table"><div className="relay-row relay-head"><span>EVENT</span><span>MISSION</span><span>LEDGER</span><span>STATUS</span></div>{(relayEvents.length ? relayEvents.slice(0, 5) : [{ id: "demo-1", type: "PLEDGE_CREATED", ledger: 5812044, contractId: "demo", topic: [], value: "3 XLM" }, { id: "demo-2", type: "PROOF_VERIFIED", ledger: 5812038, contractId: "demo", topic: [], value: "#205" }, { id: "demo-3", type: "BADGE_MINTED", ledger: 5812029, contractId: "demo", topic: [], value: "#018" }]).map((event, index) => <div className="relay-row" key={event.id}><span className="event-name"><i className={`event-dot event-${index}`} />{event.type.replaceAll("_", " ")}</span><span>{event.value || "Mission #204"}</span><span className="ledger">{event.ledger.toLocaleString()}</span><span className="event-status">confirmed <Icon name="check" size={11} /></span></div>)}</div>{relayError && <p className="relay-footnote">{relayError} Configure a deployed contract ID to replace the demo relay rows.</p>}<a className="relay-link" href="#missions">Browse all mission activity <Icon name="arrow" size={14} /></a></section>

      <section className="badge-shell"><div className="badge-copy"><div className="section-kicker"><span>06 / YOUR BADGEBOOK</span><span>Wallet-owned reputation</span></div><h2>Proof compounds<br /><em>into trust.</em></h2><p>Successful verification calls the Badge Registry contract. Your wallet becomes a living record of the work you helped move forward.</p><a href="#top" className="secondary-cta">Connect to view your badgebook <Icon name="arrow" size={15} /></a></div><div className="badgebook"><div className="badgebook-header"><span>IMPACT BADGES</span><span>03 collected</span></div><div className="badge-list">{badgeNames.map((badge, index) => <div className="badge-item" key={badge}><span className={`badge-disc badge-${index}`}><Icon name={index === 1 ? "pulse" : index === 2 ? "shield" : "spark"} size={18} /></span><span><strong>{badge}</strong><small>Verified on Testnet</small></span><Icon name="arrow" size={14} /></div>)}</div><div className="badgebook-foot"><span><Icon name="shield" size={14} /> Non-transferable proof</span><span>Registry v0.1</span></div></div></section>

      <footer className="footer-shell"><a className="logo" href="#top"><span className="logo-mark"><Icon name="spark" size={17} /></span><span><strong>ProofPatch</strong><small>impact relay</small></span></a><p>Small actions deserve public proof.</p><div><a href="#missions">Discover</a><a href="#how">Protocol</a><a href="#relay">Relay</a><span>Stellar Testnet · 2026</span></div></footer>

      {walletPanelOpen && <div className="wallet-overlay" role="dialog" aria-modal="true"><div className="wallet-modal"><button className="modal-close" onClick={() => setWalletPanelOpen(false)}>×</button><div className="modal-kicker">CONNECT TO PROOFPATCH</div><h2>Choose your wallet</h2><p>Use a wallet you control. We never ask for a private key or seed phrase.</p><div className="wallet-options">{wallet.availableWallets.map((available) => <button key={available.id} className="wallet-option" onClick={() => { void wallet.connectWith(available.id as WalletType); setWalletPanelOpen(false); }}><span className="wallet-option-icon">{available.icon ? <img src={available.icon} alt="" /> : <Icon name="wallet" size={18} />}</span><span><strong>{available.name}</strong><small>{available.installed ? "Ready to connect" : "Open wallet"}</small></span><Icon name="arrow" size={15} /></button>)}</div>{wallet.isConnected && <button className="disconnect-button" onClick={() => { void wallet.disconnect(); setWalletPanelOpen(false); }}>Disconnect {shorten(wallet.address ?? "wallet")}</button>}{wallet.error && <p className="wallet-error">{wallet.error}</p>}<div className="modal-foot"><span className="network-icon" /> Stellar Testnet only</div></div></div>}
    </main>
  );
}
