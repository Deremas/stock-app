import { expect, test } from "@playwright/test";

test("login page renders the authentication form", async ({ page }) => {
  const response = await page.goto("/login");

  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByLabel(/email, username, or phone/i)).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Password" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("admin can open the cash-to-bank workflow", async ({ page }) => {
  test.setTimeout(120_000);

  const username = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  test.skip(!username || !password, "E2E credentials are not configured.");

  await page.goto("/login?next=%2Ffinance%2Fcash%3Fopen%3D1");
  await page.getByLabel(/email, username, or phone/i).fill(username ?? "");
  await page.getByRole("textbox", { name: "Password" }).fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/finance\/cash/, { timeout: 60_000 });
  await page.goto("/finance/cash?open=1");
  await expect(
    page.getByRole("heading", { name: "Cash to Bank", level: 2 }),
  ).toBeVisible();
  await expect(
    page.locator("form").getByRole("heading", {
      name: "Deposit cash to bank",
    }),
  ).toBeVisible();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Cash account", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Bank account", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Amount", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Post deposit", exact: true }),
  ).toBeVisible();
});
