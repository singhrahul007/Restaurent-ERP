import { describe, expect, it } from "vitest";
import { buildOndcCatalog } from "./catalog.js";

describe("ONDC Catalog Builder", () => {
  it("formats restaurant menu into Beckn provider catalog", () => {
    const catalog = buildOndcCatalog({
      restaurant: {
        id: "rest-001",
        name: "Spice Symphony",
        currency: "INR",
      },
      branch: {
        id: "branch-001",
        name: "Indiranagar Branch",
        addressLine1: "100ft Road",
        city: "Bengaluru",
        region: "Karnataka",
        postalCode: "560038",
        country: "IND",
      },
      categories: [
        { id: "cat-1", name: "Starters", sortOrder: 1 },
        { id: "cat-2", name: "Main Course", sortOrder: 2 },
      ],
      items: [
        {
          id: "item-1",
          name: "Paneer Tikka",
          description: "Fresh cottage cheese roasted in tandoor",
          categoryId: "cat-1",
          basePriceMinor: 25000, // 250.00
          available: true,
        },
        {
          id: "item-2",
          name: "Dal Makhani",
          description: "Slow cooked black lentils",
          categoryId: "cat-2",
          basePriceMinor: 30000, // 300.00
          available: false, // 86ed
        },
      ],
      variants: [],
    });

    expect(catalog["bpp/providers"]?.length).toBe(1);
    const provider = catalog["bpp/providers"]![0]!;
    expect(provider.id).toBe("rest-001");
    expect(provider.categories?.length).toBe(2);

    // Item-2 was out of stock, only item-1 should be present
    expect(provider.items?.length).toBe(1);
    expect(provider.items![0]!.id).toBe("item-1");
    expect(provider.items![0]!.price.value).toBe("250.00");
    expect(provider.locations?.length).toBe(1);
    expect(provider.locations![0]!.address?.city).toBe("Bengaluru");
  });

  it("handles item variants correctly", () => {
    const catalog = buildOndcCatalog({
      restaurant: { id: "rest-001", name: "Pizzeria", currency: "INR" },
      branch: { id: "b-1", name: "MG Road" },
      categories: [{ id: "c-1", name: "Pizzas" }],
      items: [
        {
          id: "pizza-1",
          name: "Margherita",
          categoryId: "c-1",
          basePriceMinor: 20000,
          available: true,
        },
      ],
      variants: [
        { id: "v-reg", menuItemId: "pizza-1", name: "Regular", priceDeltaMinor: 0 },
        { id: "v-med", menuItemId: "pizza-1", name: "Medium", priceDeltaMinor: 15000 },
      ],
    });

    const items = catalog["bpp/providers"]![0]!.items!;
    expect(items.length).toBe(2);
    expect(items[0]!.price.value).toBe("200.00");
    expect(items[1]!.price.value).toBe("350.00");
  });
});

