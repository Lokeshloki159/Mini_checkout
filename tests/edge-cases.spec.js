// @ts-check
/*
 * Regression checks for the two scenarios that were tested manually
 * (empty cart, rapid double-click). They also save screenshots into
 * ./evidence so the results can be inspected by someone else.
 */
const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("cart-empty")).toBeVisible();
});

test("empty cart blocks checkout and keeps the typed name", async ({ page }) => {
  await page.getByLabel("Full name").fill("Asha Rao");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page.getByTestId("form-error")).toContainText(
    "Your cart is empty. Add at least one item to place an order.");
  await expect(page.getByTestId("name-error")).toBeHidden();
  await expect(page.getByLabel("Full name")).toHaveValue("Asha Rao");
  await expect(page.getByTestId("confirmation")).toBeHidden();
  await page.screenshot({ path: "evidence/empty-cart-blocked.png", fullPage: true });

  // Adding an item clears the cart message without retyping anything.
  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();
  await expect(page.getByTestId("form-error")).toBeHidden();
  await expect(page.getByLabel("Full name")).toHaveValue("Asha Rao");
});

test("empty cart and blank name together show both messages", async ({ page }) => {
  await page.getByRole("button", { name: "Place order" }).click();
  const summary = page.getByTestId("form-error");
  await expect(summary).toContainText("Your cart is empty.");
  await expect(summary).toContainText("Please enter your full name.");
  await expect(page.getByTestId("confirmation")).toBeHidden();
});

test("rapid double-click on Place order creates exactly one order", async ({ page }) => {
  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();
  await page.getByLabel("Full name").fill("Asha Rao");

  await page.getByRole("button", { name: "Place order" }).dblclick();

  await expect(page.getByTestId("confirmation")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order confirmed" })).toHaveCount(1);
  expect(await page.evaluate(() => window.miniCheckout.orderCount())).toBe(1);
  // Regression for D-01: the second press must not highlight text on the confirmation.
  expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
  await page.screenshot({ path: "evidence/double-click-one-confirmation.png", fullPage: true });
});

test("two submits fired in the same instant still create one order", async ({ page }) => {
  await page.getByRole("button", { name: "Add Steel Water Bottle to cart" }).click();
  await page.getByLabel("Full name").fill("Asha Rao");

  // Faster than any human: both submits run before the browser repaints.
  await page.evaluate(() => {
    const form = document.getElementById("checkout-form");
    form.requestSubmit();
    form.requestSubmit();
  });

  await expect(page.getByTestId("confirmation")).toBeVisible();
  const ref = await page.getByTestId("order-ref").textContent();
  expect(await page.evaluate(() => window.miniCheckout.orderCount())).toBe(1);
  await expect(page.getByTestId("order-ref")).toHaveText(ref ?? "");
});

test("starting a new order returns to a clean, usable checkout", async ({ page }) => {
  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();
  await page.getByLabel("Full name").fill("Asha Rao");
  await page.getByRole("button", { name: "Place order" }).click();
  await page.getByRole("button", { name: "Start a new order" }).click();

  await expect(page.getByTestId("cart-empty")).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("");
  await expect(page.getByTestId("form-error")).toBeHidden();
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
});
