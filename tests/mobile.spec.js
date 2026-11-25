// @ts-check
/*
 * Regression for D-02: on a phone-sized screen the order total must stay
 * visible and correct, and the page must not scroll sideways.
 */
const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 375, height: 800 } });

test("phone width: order total visible, correct, no sideways scrolling", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("cart-empty")).toBeVisible();

  await page.getByRole("button", { name: "Add Canvas Tote Bag to cart" }).click();
  await page.getByRole("button", { name: "Add Steel Water Bottle to cart" }).click();

  const total = page.getByTestId("order-total");
  await expect(total).toBeVisible();
  await expect(total).toHaveText("₹1,548.50");
  await expect(page.getByTestId("line-total-tote")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Steel Water Bottle" })).toBeInViewport({ ratio: 1 });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);

  await page.screenshot({ path: "evidence/phone-width-order-total.png", fullPage: true });
});
