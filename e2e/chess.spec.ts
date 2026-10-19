import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createGame } from "../src/lib/chess";

async function move(page: Page, from: string, to: string) {
  await page.getByTestId(`square-${from}`).click();
  await page.getByTestId(`square-${to}`).click();
}
async function localGame(page: Page) {
  await page.locator(".setup-card").getByRole("button", { name: "Local", exact: true }).click();
  await page.locator(".setup-card").getByRole("button", { name: "Let's play", exact: true }).click();
  await expect(page.locator(".board-mode")).toContainText("PASS & PLAY");
}
test("desktop: real Stockfish replies to a legal move; takeback and hints work", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/");
  await expect(page.getByTestId("square-e2")).toHaveAttribute("aria-label", /White pawn/);
  const pieces = page.locator(".chessboard .chess-piece");
  await expect(pieces).toHaveCount(32);
  expect(await pieces.evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth === 100 && image.src.includes("/pieces/skak/")))).toBe(true);
  await expect(page.locator(".engine-status")).toContainText("Stockfish 18 inside", { timeout: 45000 });
  mkdirSync("artifacts/screenshots", { recursive: true });
  await page.screenshot({ path: "artifacts/screenshots/desktop.png", fullPage: true });
  await move(page, "e2", "e4");
  await expect(page.locator(".moves-card .move-cell")).toHaveCount(2, { timeout: 30000 });
  await expect(page.locator(".game-status")).toContainText("Your move");
  await expect(page.locator(".error-banner")).toHaveCount(0);
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.locator(".move-arrow")).toHaveCount(1);
  await page.getByRole("button", { name: "Take back", exact: true }).click();
  await expect(page.locator(".moves-card .move-cell")).toHaveCount(0);
  await expect(page.getByTestId("square-e2")).toHaveAttribute("aria-label", /White pawn/);
  expect(errors).toEqual([]);
});

test("local game: checkmate, real engine blunder review, history, PGN export and reload", async ({ page }) => {
  await page.goto("/"); await localGame(page);
  await move(page, "f2", "f3"); await move(page, "e7", "e5"); await move(page, "g2", "g4"); await move(page, "d8", "h4");
  await expect(page.locator(".result-banner")).toContainText("Black wins");
  await expect(page.locator(".result-banner")).toContainText("Checkmate");
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Download PGN", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pgn$/);
  await page.locator(".result-banner").getByRole("button", { name: "Game review" }).click();
  await page.getByLabel("Analysis depth").selectOption("12");
  await expect(page.getByRole("button", { name: "Analyze this game" })).toBeEnabled({ timeout: 45000 });
  await page.getByRole("button", { name: "Analyze this game" }).click();
  await expect(page.locator(".analysis-complete")).toBeVisible({ timeout: 45000 });
  await expect(page.locator(".review-moves .move-cell")).toHaveCount(4);
  await page.locator(".review-moves").getByRole("button", { name: /Move 2, White: g4/ }).click();
  await expect(page.locator(".insight-head")).toContainText("blunder");
  await expect(page.locator(".best-move strong")).not.toHaveText("—");
  await expect(page.locator(".principal-variation>span").first()).toBeVisible();
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await expect(page.locator(".eval-score")).toHaveText("M0");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/screenshots/review.png", fullPage: true });
  await page.locator(".sidebar").getByRole("button", { name: /My games/ }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.reload(); await page.locator(".sidebar").getByRole("button", { name: /My games/ }).click();
  await page.locator(".history-row").getByRole("button", { name: "Review" }).click();
  await expect(page.locator(".analysis-complete")).toBeVisible();
});

test("board controls: illegal moves, drag/drop, flip, keyboard, and saved preferences", async ({ page }) => {
  await page.goto("/"); await localGame(page);
  await move(page, "e2", "e5");
  await expect(page.getByTestId("square-e2")).toHaveAttribute("aria-label", /White pawn/);
  await page.getByTestId("square-e2").locator(".piece-wrap").dragTo(page.getByTestId("square-e4"));
  await expect(page.getByTestId("square-e4")).toHaveAttribute("aria-label", /White pawn/);
  await page.getByRole("button", { name: "Flip board", exact: true }).click();
  await expect(page.locator(".square").first()).toHaveAttribute("data-testid", "square-h1");
  await page.locator(".board-toolbar").getByRole("button", { name: "Board settings" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Walnut" }).click();
  await page.getByRole("dialog").getByLabel("Board coordinates").uncheck();
  await page.getByRole("button", { name: "All set" }).click();
  await expect(page.locator(".chessboard")).toHaveClass(/walnut/);
  await expect(page.locator(".coord")).toHaveCount(0);
  await page.reload(); await expect(page.locator(".chessboard")).toHaveClass(/walnut/);
  await page.getByTestId("square-e7").focus(); await page.keyboard.press("Enter");
  await expect(page.getByTestId("square-e7")).toHaveAttribute("aria-pressed", "true");
});

test("promotion asks for the piece and supports underpromotion", async ({ page }) => {
  const game = createGame({ mode: "local", initialFen: "8/P6k/8/8/8/8/8/7K w - - 0 1" });
  await page.addInitScript(g => localStorage.setItem("knightfall.current.v1", JSON.stringify(g)), game);
  await page.goto("/"); await move(page, "a7", "a8");
  await expect(page.getByRole("dialog")).toContainText("promotion");
  await page.getByRole("button", { name: "Promote to knight" }).click();
  await expect(page.getByTestId("square-a8")).toHaveAttribute("aria-label", /White knight/);
  await expect(page.locator(".result-banner")).toContainText("Insufficient material");
});

test("online: separate visitors join, sync moves, reconnect, spectate and agree a draw", async ({ page, browser, baseURL }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.locator(".setup-card").getByRole("button", { name: "A friend" }).click();
  await page.getByLabel("Your name").fill("E2E White");
  await page.getByRole("button", { name: "Create a friend game" }).click();
  await expect(page.getByLabel("Game invite link")).toBeVisible({ timeout: 30000 });
  const invite = await page.getByLabel("Game invite link").inputValue();
  const context = await browser.newContext({ baseURL }); const black = await context.newPage();
  const spectatorContext = await browser.newContext({ baseURL }); const spectator = await spectatorContext.newPage();
  try {
    await black.goto(invite); await black.getByLabel("Your name").fill("E2E Black");
    await black.getByRole("button", { name: "Join as Black" }).click();
    await expect(black.locator(".room-status")).toContainText("You're playing Black");
    await expect(page.locator(".room-status")).toContainText("You're in");
    await move(page, "e2", "e4");
    await expect(black.getByTestId("square-e4")).toHaveAttribute("aria-label", /White pawn/);
    await move(black, "e7", "e5");
    await expect(page.getByTestId("square-e5")).toHaveAttribute("aria-label", /Black pawn/);
    await page.reload(); await expect(page.locator(".room-status")).toContainText("You're playing White");
    await spectator.goto(invite); await expect(spectator.locator(".room-status")).toContainText("spectator");
    await expect(spectator.getByRole("button", { name: "Hint", exact: true })).toBeDisabled();
    await expect(spectator.getByRole("button", { name: "Resign", exact: true })).toBeDisabled();
    await spectator.locator(".sidebar").getByRole("button", { name: "Game review", exact: true }).click();
    await expect(spectator.locator(".toast")).toContainText("Finish the online game");
    await page.getByRole("button", { name: "Offer draw" }).click();
    await page.getByRole("button", { name: "Send offer" }).click();
    await expect(black.locator(".draw-offer")).toContainText("Your opponent offered a draw");
    await black.getByRole("button", { name: "Accept draw" }).click();
    await expect(page.locator(".result-banner")).toContainText("Draw by agreement");
    await expect(black.locator(".result-banner")).toContainText("Draw by agreement");
  } finally { await context.close(); await spectatorContext.close(); }
});

test("mobile: responsive, no overflow, playable by touch and PGN import", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await expect(page.getByTestId("square-e2")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/screenshots/mobile.png", fullPage: true });
  await localGame(page); await move(page, "d2", "d4");
  await expect(page.getByTestId("square-d4")).toHaveAttribute("aria-label", /White pawn/);
  await page.locator(".mobile-nav").getByRole("button", { name: "My games" }).click();
  await page.getByRole("button", { name: "Import PGN" }).click();
  await page.getByRole("textbox", { name: "PGN", exact: true }).fill('[White "Mobile"]\n[Black "Import"]\n\n1. e4 e5 2. Nf3 Nc6 *');
  await page.getByRole("button", { name: "Import and review" }).click();
  await expect(page.locator(".review-moves .move-cell")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("engine failure is visible; local chess still works", async ({ page }) => {
  await page.route("**/engine/manifest.json", route => route.abort("failed"));
  await page.goto("/");
  await expect(page.locator(".error-banner")).toContainText("Stockfish couldn’t load");
  await localGame(page); await move(page, "e2", "e4");
  await expect(page.getByTestId("square-e4")).toHaveAttribute("aria-label", /White pawn/);
});