import type {
  BecknCatalog,
  BecknCategory,
  BecknItem,
  BecknLocation,
  BecknProvider,
} from "@niva/types";

export interface RestaurantMenuCatalogInput {
  restaurant: {
    id: string;
    name: string;
    currency: string;
  };
  branch: {
    id: string;
    name: string;
    addressLine1?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  categories: Array<{
    id: string;
    name: string;
    parentId?: string | null;
    sortOrder?: number;
  }>;
  items: Array<{
    id: string;
    name: string;
    description?: string | null;
    categoryId: string;
    basePriceMinor: number;
    available: boolean;
  }>;
  variants?: Array<{
    id: string;
    menuItemId: string;
    name: string;
    priceDeltaMinor: number;
  }>;
  availabilityOverrides?: Array<{
    menuItemId: string;
    available: boolean;
  }>;
  providerLocationId?: string;
  domain?: string;
}

/**
 * Transforms internal multi-tenant restaurant menu, categories, and branch details
 * into standard ONDC RET11 Beckn Provider Catalog schema.
 */
export function buildOndcCatalog(input: RestaurantMenuCatalogInput): BecknCatalog {
  const { restaurant, branch, categories, items, variants = [], availabilityOverrides = [] } = input;

  const locationId = input.providerLocationId ?? `LOC_${branch.id.slice(0, 8)}`;
  const currency = restaurant.currency ?? "INR";

  // Build 86 / availability index
  const availabilityMap = new Map<string, boolean>();
  for (const item of items) {
    availabilityMap.set(item.id, item.available);
  }
  for (const override of availabilityOverrides) {
    availabilityMap.set(override.menuItemId, override.available);
  }

  // Format Beckn categories
  const becknCategories: BecknCategory[] = categories.map((cat) => ({
    id: cat.id,
    parent_category_id: cat.parentId ?? undefined,
    descriptor: {
      name: cat.name,
      code: cat.name.toUpperCase().replace(/\s+/g, "_"),
    },
  }));

  // Format Beckn items
  const becknItems: BecknItem[] = [];

  for (const item of items) {
    const isAvailable = availabilityMap.get(item.id) ?? true;
    if (!isAvailable) {
      // ONDC items can either be omitted or tagged out of stock
      continue;
    }

    const priceRupees = (item.basePriceMinor / 100).toFixed(2);
    const itemVariants = variants.filter((v) => v.menuItemId === item.id);

    if (itemVariants.length > 0) {
      // Has variants - parent item + child items
      for (const variant of itemVariants) {
        const variantPrice = ((item.basePriceMinor + variant.priceDeltaMinor) / 100).toFixed(2);
        becknItems.push({
          id: `${item.id}:${variant.id}`,
          parent_item_id: item.id,
          descriptor: {
            name: `${item.name} - ${variant.name}`,
            short_desc: item.description ?? item.name,
          },
          price: {
            currency,
            value: variantPrice,
            maximum_value: variantPrice,
          },
          category_id: item.categoryId,
          location_id: locationId,
          fulfillment_id: "F1",
          recommended: true,
          "@ondc/org/returnable": false,
          "@ondc/org/cancellable": true,
          "@ondc/org/return_window": "PT0M",
          "@ondc/org/time_to_ship": "PT30M",
          "@ondc/org/available_on_cod": false,
          tags: [
            {
              code: "veg_nonveg",
              list: [{ code: "type", value: "veg" }],
            },
          ],
        });
      }
    } else {
      becknItems.push({
        id: item.id,
        descriptor: {
          name: item.name,
          short_desc: item.description ?? item.name,
        },
        price: {
          currency,
          value: priceRupees,
          maximum_value: priceRupees,
        },
        category_id: item.categoryId,
        location_id: locationId,
        fulfillment_id: "F1",
        recommended: true,
        "@ondc/org/returnable": false,
        "@ondc/org/cancellable": true,
        "@ondc/org/return_window": "PT0M",
        "@ondc/org/time_to_ship": "PT30M",
        "@ondc/org/available_on_cod": false,
        tags: [
          {
            code: "veg_nonveg",
            list: [{ code: "type", value: "veg" }],
          },
        ],
      });
    }
  }

  const becknLocation: BecknLocation = {
    id: locationId,
    address: {
      name: branch.name,
      street: branch.addressLine1 ?? undefined,
      city: branch.city ?? "Bengaluru",
      state: branch.region ?? "Karnataka",
      area_code: branch.postalCode ?? "560001",
      country: branch.country ?? "IND",
    },
    time: {
      schedule: {
        frequency: "PT1H",
        holidays: [],
      },
      range: {
        start: "0800",
        end: "2300",
      },
    },
  };

  const provider: BecknProvider = {
    id: restaurant.id,
    descriptor: {
      name: restaurant.name,
      short_desc: `${restaurant.name} (${branch.name})`,
    },
    locations: [becknLocation],
    categories: becknCategories,
    items: becknItems,
    fulfillments: [
      { id: "F1", type: "Delivery" },
      { id: "F2", type: "Pickup" },
    ],
  };

  return {
    "bpp/descriptor": {
      name: "Niva Restaurant Operating System BPP",
      short_desc: "Niva ONDC Seller Adapter",
    },
    "bpp/providers": [provider],
    "bpp/fulfillments": [
      { id: "F1", type: "Delivery" },
      { id: "F2", type: "Pickup" },
    ],
  };
}

