// @ts-check
/*
 * The three required checks.
 *
 * Clean state: Playwright gives every test a brand-new browser context
 * (no cookies, no storage, no shared page) and each test loads the page itself.
 *
 * Assertions target what the customer sees (visible text, roles, labels).
 * `expect(...)` retries automatically until it passes or times out, so there
 * are no fixed waits anywhere.
 *
 * Expected money values are written out literally (not computed with the
 * app's own code) so a bug in the app's maths cannot hide itself.
 */
const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Prove the starting state is clean before doing anything.
  await expect(page.getByTestId("cart-empty")).toHaveText("Your cart is empty.");
  await expect(page.getByLabel("Full name")).toHaveValue("");
});

test("1. successful checkout shows one confirmation with a reference", async ({ page }) => {
  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();
  await page.getByRole("button", { name: "Add Steel Water Bottle to cart" }).click();
  await expect(page.getByTestId("order-total")).toHaveText("₹1,548.50");

  await page.getByLabel("Full name").fill("Asha Rao");
  await page.getByRole("button", { name: "Place order" }).click();

  const confirmation = page.getByTestId("confirmation");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("heading")).toHaveText("Order confirmed");
  await expect(confirmation).toContainText("Thank you, Asha Rao.");
  await expect(page.getByTestId("order-ref")).toHaveText(/^MC-\d{8}-[0-9A-F]{6}$/);
  await expect(page.getByTestId("confirm-total")).toHaveText("₹1,548.50");

  // The checkout form is gone, so the order cannot be resubmitted.
  await expect(page.getByRole("button", { name: "Place order" })).toBeHidden();
  expect(await page.evaluate(() => window.miniCheckout.orderCount())).toBe(1);
});

test("2. blank name blocks checkout, explains why and keeps the cart", async ({ page }) => {
  await page.getByRole("button", { name: "Add Steel Water Bottle to cart" }).click();

  // Name left blank (only spaces, which must also count as blank).
  await page.getByLabel("Full name").fill("   ");
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page.getByTestId("name-error")).toHaveText("Please enter your full name.");
  await expect(page.getByTestId("form-error")).toContainText("Please enter your full name.");
  await expect(page.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Full name")).toBeFocused();

  // No order was placed and nothing the customer chose was lost.
  await expect(page.getByTestId("confirmation")).toBeHidden();
  await expect(page.getByTestId("qty-bottle")).toHaveText("1");
  await expect(page.getByTestId("order-total")).toHaveText("₹1,199.00");
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
  expect(await page.evaluate(() => window.miniCheckout.orderCount())).toBe(0);

  // Fixing the field clears the message.
  await page.getByLabel("Full name").fill("Asha Rao");
  await expect(page.getByTestId("name-error")).toBeHidden();
});

test("3. changing quantity updates line totals and the exact order total", async ({ page }) => {
  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();
  await expect(page.getByTestId("line-total-tote")).toHaveText("₹349.50");
  await expect(page.getByTestId("order-total")).toHaveText("₹349.50");

  const increaseTote = page.getByRole("button", { name: "Increase quantity of Canvas Tote Bag" });
  await increaseTote.click();
  await increaseTote.click();
  await expect(page.getByTestId("qty-tote")).toHaveText("3");
  await expect(page.getByTestId("line-total-tote")).toHaveText("₹1,048.50");   // 3 × 349.50
  await expect(page.getByTestId("order-total")).toHaveText("₹1,048.50");

  await page.getByRole("button", { name: "Add Steel Water Bottle to cart" }).click();
  await expect(page.getByTestId("line-total-bottle")).toHaveText("₹1,199.00");
  await expect(page.getByTestId("order-total")).toHaveText("₹2,247.50");     // 1,048.50 + 1,199.00

  await page.getByRole("button", { name: "Decrease quantity of Canvas Tote Bag" }).click();
  await expect(page.getByTestId("qty-tote")).toHaveText("2");
  await expect(page.getByTestId("line-total-tote")).toHaveText("₹699.00");     // 2 × 349.50
  await expect(page.getByTestId("order-total")).toHaveText("₹1,898.00");     // 699.00 + 1,199.00

  await page.getByRole("button", { name: "Remove Steel Water Bottle" }).click();
  await expect(page.getByTestId("cart-row-bottle")).toHaveCount(0);
  await expect(page.getByTestId("order-total")).toHaveText("₹699.00");
});
