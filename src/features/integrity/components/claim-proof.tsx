"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Anchor } from "../contracts";

type ProofData = {
  commitment: { digest: string; data: string; canonical: string };
  resolution: { digest: string; data: string; canonical: string } | null;
  anchors: Anchor[];
};
type Wallet = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
export function ClaimProof({ claimId, canManage }: { claimId: string; canManage: boolean }) {
  const [proof, setProof] = useState<ProofData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState("");
  const [kind, setKind] = useState<"commitment" | "resolution">("commitment");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/claims/${claimId}/proof`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setProof(body);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error.message);
      });
    return () => controller.abort();
  }, [claimId]);
  async function verify(transactionHash: string) {
    const response = await fetch(`/api/claims/${claimId}/proof`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionHash, kind }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setMessage("Confirmed on Base Sepolia. Reload to view the saved proof.");
  }
  async function anchor() {
    setBusy(true);
    setMessage("");
    try {
      const wallet = (window as unknown as { ethereum?: Wallet }).ethereum;
      if (!wallet)
        throw new Error(
          "Install or open a browser wallet to anchor this record. You will need Base Sepolia test ETH for gas.",
        );
      const accounts = (await wallet.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts[0]) throw new Error("No wallet account selected.");
      try {
        await wallet.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x14a34" }],
        });
      } catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await wallet.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x14a34",
              chainName: "Base Sepolia",
              rpcUrls: ["https://sepolia.base.org"],
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              blockExplorerUrls: ["https://sepolia.basescan.org"],
            },
          ],
        });
        await wallet.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x14a34" }],
        });
      }
      if ((await wallet.request({ method: "eth_chainId" })) !== "0x14a34")
        throw new Error("Select Base Sepolia in your wallet.");
      const selected = kind === "commitment" ? proof?.commitment : proof?.resolution;
      if (!selected) throw new Error("The selected record is unavailable.");
      // A zero-value self transaction stores only the digest in public calldata.
      const txHash = (await wallet.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: accounts[0],
            to: accounts[0],
            value: "0x0",
            data: selected.data,
            chainId: "0x14a34",
          },
        ],
      })) as string;
      setHash(txHash);
      setMessage("Transaction submitted. Wait for confirmation, then select Verify transaction.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet request was not completed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-panel replay-reasoning" aria-label="Blockchain history proof">
      <span className="eyebrow">BASE SEPOLIA · TESTNET HISTORY PROOF</span>
      <h2>{proof?.anchors.length ? "Blockchain receipts" : "Anchor this record"}</h2>
      <p>
        A confirmed hash lets readers check that the saved wording and terms match the record
        anchored at that block time. Outcomes can be anchored separately, linked to the original
        commitment hash.
      </p>
      {proof && (
        <>
          <p className="field-help">
            Commitment SHA-256:{" "}
            <code style={{ overflowWrap: "anywhere" }}>{proof.commitment.digest}</code>
          </p>
          {proof.anchors.map((receipt) => (
            <p key={receipt.id}>
              <a
                className="text-link"
                target="_blank"
                rel="noreferrer"
                href={`https://sepolia.basescan.org/tx/${receipt.transaction_hash}`}
              >
                {receipt.record_kind} proof · block {receipt.block_number}
              </a>{" "}
              · {new Date(receipt.anchored_at).toISOString()}
            </p>
          ))}
          <a
            className="text-link"
            download={`marktothesis-${claimId}-proof.json`}
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(proof, null, 2))}`}
          >
            Download proof and canonical record
          </a>
          {canManage && (
            <div className="field-group">
              <label htmlFor="proof-kind">Record to anchor</label>
              <select
                id="proof-kind"
                value={kind}
                onChange={(event) => {
                  setKind(event.target.value as typeof kind);
                  setHash("");
                }}
              >
                <option value="commitment">Original commitment</option>
                {proof.resolution && <option value="resolution">Resolved outcome</option>}
              </select>
              <Button onClick={anchor} disabled={busy}>
                {busy ? "Waiting for wallet…" : "Anchor with wallet"}
              </Button>
              <label htmlFor="proof-tx">
                Transaction hash (also accepts a previously submitted transaction)
              </label>
              <input
                id="proof-tx"
                value={hash}
                onChange={(event) => setHash(event.target.value)}
                placeholder="0x…"
              />
              <Button
                variant="secondary"
                disabled={busy || !/^0x[0-9a-fA-F]{64}$/.test(hash)}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await verify(hash);
                  } catch (error) {
                    setMessage((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Verify transaction
              </Button>
            </div>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
      <p className="field-help">
        An unanchored record is not yet on chain. Testnet anchoring confirms a record hash and block
        time; it does not verify a trade or prove a prediction existed before its app logging time.
      </p>
    </section>
  );
}
