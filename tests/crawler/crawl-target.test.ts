import { describe, expect, it } from "vitest";
import { crawlTarget, isPrivateAreaUrl, isQueryVariantOf, isViewParam, stripViewParams } from "@/lib/crawler/normalize";

const B = "https://pubesto.example";

describe("stripViewParams (filter / sort / search links are the same page)", () => {
  it("collapses shop filter, sort and tag links to the base page", () => {
    for (const q of ["category=Fans", "sort=newest", "tag=Diwali", "color=red&size=XL", "price_min=100&price_max=900", "filter[brand]=x", "q=fan", "view=grid", "variant=123", "currency=INR", "ref=home"]) {
      expect(stripViewParams(`${B}/shop?${q}`)).toBe(`${B}/shop`);
    }
  });
  it("keeps pagination and parameters that pick real content", () => {
    expect(stripViewParams(`${B}/shop?page=2&sort=newest`)).toBe(`${B}/shop?page=2`);
    expect(stripViewParams(`${B}/?p=123`)).toBe(`${B}/?p=123`);
    expect(stripViewParams(`${B}/index.php?page_id=7`)).toBe(`${B}/index.php?page_id=7`);
    expect(stripViewParams(`${B}/product?id=55&utm_source=x`)).toBe(`${B}/product?id=55`);
    expect(stripViewParams(`${B}/?cat=3`)).toBe(`${B}/?cat=3`);
    expect(stripViewParams(`${B}/watch?v=abc`)).toBe(`${B}/watch?v=abc`);
  });
  it("leaves unknown parameters alone", () => {
    expect(stripViewParams(`${B}/events?year=2026`)).toBe(`${B}/events?year=2026`);
    expect(isViewParam("year")).toBe(false);
    expect(isViewParam("Sort")).toBe(true);
    expect(isViewParam("utm_campaign")).toBe(true);
  });
  it("returns null for unusable addresses", () => {
    expect(stripViewParams("mailto:a@b.com")).toBeNull();
  });
});

describe("isPrivateAreaUrl", () => {
  it("spots account, cart, checkout and login screens", () => {
    for (const p of ["/account", "/account?tab=orders", "/account/orders", "/cart", "/checkout/step-2", "/login", "/wishlist", "/my-account/", "/en/cart", "/wp-login.php", "/sign-in"]) {
      expect(isPrivateAreaUrl(`${B}${p}`), p).toBe(true);
    }
  });
  it("does not catch normal pages with similar words", () => {
    for (const p of ["/", "/accounting-services", "/blog/cart-abandonment", "/shop", "/login-help-guide", "/cartridges", "/services/account-management"]) {
      expect(isPrivateAreaUrl(`${B}${p}`), p).toBe(false);
    }
  });
});

describe("crawlTarget", () => {
  it("reads the page behind a filter link and says why", () => {
    expect(crawlTarget(`${B}/shop?category=Fans`)).toEqual({ url: `${B}/shop`, skipped: "filter" });
    expect(crawlTarget(`${B}/shop?page=3`)).toEqual({ url: `${B}/shop?page=3`, skipped: null });
    expect(crawlTarget(`${B}/about`)).toEqual({ url: `${B}/about`, skipped: null });
  });
  it("does not read account screens", () => {
    expect(crawlTarget(`${B}/account?tab=orders`)).toEqual({ url: null, skipped: "account" });
  });
  it("is null for non-web links", () => {
    expect(crawlTarget("javascript:void(0)")).toBeNull();
  });
});

describe("isQueryVariantOf (main version = same address without the query)", () => {
  it("is true when the canonical drops the query string", () => {
    expect(isQueryVariantOf(`${B}/shop?collection=summer`, `${B}/shop`)).toBe(true);
    expect(isQueryVariantOf(`${B}/shop/?collection=summer`, "/shop")).toBe(true);
    expect(isQueryVariantOf(`https://www.pubesto.example/shop?x=1`, `${B}/shop`)).toBe(true);
  });
  it("is false for a self canonical, another path, another site or no canonical", () => {
    expect(isQueryVariantOf(`${B}/shop?page=2`, `${B}/shop?page=2`)).toBe(false);
    expect(isQueryVariantOf(`${B}/shop?x=1`, `${B}/`)).toBe(false);
    expect(isQueryVariantOf(`${B}/shop?x=1`, "https://other.example/shop")).toBe(false);
    expect(isQueryVariantOf(`${B}/shop`, `${B}/shop`)).toBe(false);
    expect(isQueryVariantOf(`${B}/shop?x=1`, null)).toBe(false);
  });
});
