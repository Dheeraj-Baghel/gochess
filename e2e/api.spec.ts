import { test, expect } from "@playwright/test";

test("production-style API: durable storage, seat authorization, validation and concurrent moves", async ({ request }) => {
  const health = await request.get("/api/health"); expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe("ok");
  const created = await request.post("/api/rooms", { data: { name: "E2E API White", color: "w", timeControl: "none" } });
  expect(created.status()).toBe(201); const { room, token: white } = await created.json();
  const url = `/api/rooms/${room.id}`;
  const joined = await request.post(url, { data: { action: "join", name: "E2E API Black" } }); expect(joined.status()).toBe(200);
  const { token: black } = await joined.json();
  const unauthenticated = await request.post(url, { data: { action: "move", move: "e2e4", version: 1 } }); expect(unauthenticated.status()).toBe(403);
  const wrongTurn = await request.post(url, { headers: { Authorization: `Bearer ${black}` }, data: { action: "move", move: "e7e5", version: 1 } }); expect(wrongTurn.status()).toBe(403);
  const illegal = await request.post(url, { headers: { Authorization: `Bearer ${white}` }, data: { action: "move", move: "e2e5", version: 1 } }); expect(illegal.status()).toBe(422);
  const concurrent = await Promise.all(["e2e4", "d2d4"].map(move => request.post(url, { headers: { Authorization: `Bearer ${white}` }, data: { action: "move", move, version: 1 } })));
  expect(concurrent.map(r => r.status()).sort()).toEqual([200, 409]);
  const read = await request.get(url); const data = await read.json(); expect(data.room.game.moves).toHaveLength(1); expect(data.room.version).toBe(2); expect(data.room.yourColor).toBe(null);
  const serialized = JSON.stringify(data); expect(serialized).not.toContain(white); expect(serialized).not.toContain(black); expect(serialized).not.toContain("whiteToken");
  const forged = await request.post(url, { headers: { Authorization: `Bearer ${white}` }, data: { action: "move", move: "d8h4", version: 2, result: { winner: "w" } } }); expect(forged.status()).toBe(403);
  const resign = await request.post(url, { headers: { Authorization: `Bearer ${black}` }, data: { action: "resign", version: 2 } }); expect(resign.status()).toBe(200);
  expect((await resign.json()).room.game.result.winner).toBe("w");
  const after = await request.post(url, { headers: { Authorization: `Bearer ${white}` }, data: { action: "move", move: "d2d4", version: 3 } }); expect(after.status()).toBe(409);
  const invalid = await request.post("/api/rooms", { data: { name: "", color: "pink", timeControl: "none" } }); expect(invalid.status()).toBe(400);
  const crossSite = await request.post("/api/rooms", { headers: { Origin: "https://evil.example" }, data: { name: "Test", color: "w", timeControl: "none" } }); expect(crossSite.status()).toBe(403);
  const unknown = await request.get("/api/rooms/not-a-valid-room-id"); expect(unknown.status()).toBe(404);
});