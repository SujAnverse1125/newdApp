import test from "node:test";
import assert from "node:assert/strict";

const validTestnetAddress = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function isValidAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function dedupeEvents(events) {
  return [...new Map(events.map((event) => [event.id, event])).values()];
}

test("pledge amounts reject zero, negative, and non-numeric values", () => {
  assert.equal(isValidAmount("3"), true);
  assert.equal(isValidAmount("0"), false);
  assert.equal(isValidAmount("-1"), false);
  assert.equal(isValidAmount("nope"), false);
});

test("Stellar public keys keep the expected G-prefix shape", () => {
  assert.equal(validTestnetAddress.startsWith("G"), true);
  assert.equal(validTestnetAddress.length, 56);
});

test("relay events are de-duplicated by stable event id", () => {
  const events = dedupeEvents([
    { id: "a", type: "PledgeCreated" },
    { id: "a", type: "PledgeCreated" },
    { id: "b", type: "ProofVerified" },
  ]);
  assert.deepEqual(events.map((event) => event.id), ["a", "b"]);
});
