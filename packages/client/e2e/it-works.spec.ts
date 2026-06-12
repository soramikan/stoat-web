import { expect, test } from "@playwright/test";

test("shows a working login page", async ({ page }) => {
  await page.goto("");
  await expect(page).toHaveTitle(/Stoat/);

  const login = page.getByRole("button", { name: "Log In" });
  await expect(login).toBeVisible();
  await login.click();

  await expect(page.getByText(/Sign into Stoat/)).toBeVisible();
});

test("prefills invite code when signing up from an invite link", async ({
  page,
}) => {
  await page.goto("/invite/xxxxxxxx");

  await expect(page).toHaveURL(/\/login\/create\/xxxxxxxx$/);
  await expect(page.locator('input[name="invite"]')).toHaveValue("xxxxxxxx");
});
