// Static keyword -> category/subcategory fallback used by the category
// suggester's tier 4 (spec section 19, keyword matching) when a household has
// no usage history yet for an item. Matched against the seeded global
// category tree (migration 004/008) by NAME, never by id, since ids are
// generated at insert time and differ per environment.
//
// This is intentionally a *fallback*, not a source of truth: any household
// usage (exact item/merchant pattern) always outranks it (see
// category-suggester.ts). Keep entries mapped to real seeded names only.

export interface KeywordRule {
  keywords: string[];
  categoryName: string;
  subcategoryName?: string;
}

export const KEYWORD_RULES: KeywordRule[] = [
  // Food & Grocery
  { keywords: ["milk", "doodh"], categoryName: "Food & Grocery", subcategoryName: "Milk" },
  { keywords: ["curd", "dahi", "yogurt"], categoryName: "Food & Grocery", subcategoryName: "Curd" },
  { keywords: ["buttermilk", "chaas", "chhaas"], categoryName: "Food & Grocery", subcategoryName: "Buttermilk" },
  { keywords: ["paneer", "cottage cheese"], categoryName: "Food & Grocery", subcategoryName: "Paneer" },
  { keywords: ["vegetable", "veggies", "sabzi", "bhaji", "shaak", "shak"], categoryName: "Food & Grocery", subcategoryName: "Vegetables" },
  { keywords: ["fruit", "banana", "apple", "mango", "orange"], categoryName: "Food & Grocery", subcategoryName: "Fruits" },
  { keywords: ["bread", "bun", "bakery", "pav", "khari", "toast"], categoryName: "Food & Grocery", subcategoryName: "Bakery" },
  { keywords: ["snack", "snacks", "chips", "biscuit", "namkeen", "farsan", "nasto", "nashto", "khaman", "dhokla", "jalebi", "samosa", "kachori", "gathiya", "locho", "bhajiya", "sev", "chaat", "bhel"], categoryName: "Food & Grocery", subcategoryName: "Snacks" },
  { keywords: ["tea", "chai", "coffee", "juice", "cold drink", "soda", "sharbat"], categoryName: "Food & Grocery", subcategoryName: "Beverages" },
  { keywords: ["chicken", "mutton", "fish", "egg", "meat"], categoryName: "Food & Grocery", subcategoryName: "Meat" },
  { keywords: ["grocery", "groceries", "kirana", "kariyana", "ration", "khiru", "batter", "dmart", "d-mart", "local vendor", "local shop"], categoryName: "Food & Grocery", subcategoryName: "Grocery" },

  // Transport
  { keywords: ["petrol", "petrol pump"], categoryName: "Transport", subcategoryName: "Petrol" },
  { keywords: ["diesel"], categoryName: "Transport", subcategoryName: "Diesel" },
  { keywords: ["ev charging", "ev charge", "charging station"], categoryName: "Transport", subcategoryName: "EV Charging" },
  { keywords: ["auto", "rickshaw"], categoryName: "Transport", subcategoryName: "Auto" },
  { keywords: ["cab", "uber", "ola", "taxi"], categoryName: "Transport", subcategoryName: "Cab" },
  { keywords: ["bus"], categoryName: "Transport", subcategoryName: "Bus" },
  { keywords: ["train", "irctc", "railway"], categoryName: "Transport", subcategoryName: "Train" },
  { keywords: ["parking"], categoryName: "Transport", subcategoryName: "Parking" },
  { keywords: ["toll", "fastag"], categoryName: "Transport", subcategoryName: "Toll" },

  // Bills & Utilities
  { keywords: ["electricity", "bijli", "power bill", "discom"], categoryName: "Bills & Utilities", subcategoryName: "Electricity" },
  { keywords: ["gas", "lpg", "cylinder"], categoryName: "Bills & Utilities", subcategoryName: "Gas" },
  { keywords: ["water bill", "water tanker"], categoryName: "Bills & Utilities", subcategoryName: "Water" },
  { keywords: ["internet", "wifi", "broadband", "fiber"], categoryName: "Bills & Utilities", subcategoryName: "Internet" },
  { keywords: ["recharge", "mobile bill", "phone bill"], categoryName: "Bills & Utilities", subcategoryName: "Mobile" },
  { keywords: ["dth", "tata play", "dish tv", "d2h"], categoryName: "Bills & Utilities", subcategoryName: "DTH" },

  // Health
  { keywords: ["medicine", "tablet", "syrup"], categoryName: "Health", subcategoryName: "Medicine" },
  { keywords: ["doctor", "consultation", "clinic"], categoryName: "Health", subcategoryName: "Doctor" },
  { keywords: ["pharmacy", "chemist", "medical store"], categoryName: "Health", subcategoryName: "Pharmacy" },
  { keywords: ["dentist", "dental"], categoryName: "Health", subcategoryName: "Dental" },
  { keywords: ["lab test", "pathology", "blood test", "scan"], categoryName: "Health", subcategoryName: "Tests" },
  { keywords: ["gym", "fitness", "yoga"], categoryName: "Health", subcategoryName: "Fitness" },

  // Entertainment
  { keywords: ["movie", "cinema", "pvr", "inox"], categoryName: "Entertainment", subcategoryName: "Movies" },
  { keywords: ["netflix", "hotstar", "prime video", "ott", "spotify"], categoryName: "Entertainment", subcategoryName: "OTT" },
  { keywords: ["game", "gaming", "playstation", "xbox"], categoryName: "Entertainment", subcategoryName: "Games" },
  { keywords: ["concert", "event ticket", "show"], categoryName: "Entertainment", subcategoryName: "Events" },
  { keywords: ["restaurant", "dinner", "lunch out", "swiggy", "zomato", "cafe", "dining"], categoryName: "Entertainment", subcategoryName: "Dining Out" },

  // Fashion
  { keywords: ["shirt", "jeans", "kurta", "clothing", "clothes", "saree"], categoryName: "Fashion", subcategoryName: "Clothing" },
  { keywords: ["shoes", "footwear", "sandals", "chappal"], categoryName: "Fashion", subcategoryName: "Shoes" },
  { keywords: ["watch", "handbag", "belt", "sunglasses"], categoryName: "Fashion", subcategoryName: "Accessories" },
  { keywords: ["makeup", "cosmetics", "lipstick", "skincare"], categoryName: "Fashion", subcategoryName: "Cosmetics" },

  // Electronics
  { keywords: ["mobile phone", "smartphone", "iphone"], categoryName: "Electronics", subcategoryName: "Mobile" },
  { keywords: ["laptop", "macbook"], categoryName: "Electronics", subcategoryName: "Laptop" },
  { keywords: ["charger", "cable", "earphone", "headphone"], categoryName: "Electronics", subcategoryName: "Accessories" },
  { keywords: ["fridge", "refrigerator", "washing machine", "ac", "air conditioner", "microwave"], categoryName: "Electronics", subcategoryName: "Appliances" },

  // Household
  { keywords: ["cleaning", "detergent", "soap", "dishwash"], categoryName: "Household", subcategoryName: "Cleaning" },
  { keywords: ["utensil", "cookware", "kitchenware"], categoryName: "Household", subcategoryName: "Kitchen" },
  { keywords: ["furniture", "sofa", "bed", "table", "chair"], categoryName: "Household", subcategoryName: "Furniture" },
  { keywords: ["decor", "curtain", "lamp"], categoryName: "Household", subcategoryName: "Home Decor" },
  { keywords: ["repair", "plumber", "electrician", "maintenance"], categoryName: "Household", subcategoryName: "Maintenance" },

  // Shopping
  { keywords: ["online shopping", "e-commerce"], categoryName: "Shopping", subcategoryName: "Online Shopping" },
  { keywords: ["courier", "shiprocket", "shipment", "parcel", "speed post", "shipping charges"], categoryName: "Shopping", subcategoryName: "Online Shopping" },
  { keywords: ["stationery", "xerox", "photocopy", "printout", "printing", "book stock", "books", "document"], categoryName: "Shopping", subcategoryName: "General Shopping" },

  // Homemade Business
  { keywords: ["luxekraft", "craft material", "craft raw material", "mobile cover", "phone cover", "mobile case", "blank cover", "blank case", "cover stock"], categoryName: "Homemade Business", subcategoryName: "LuxeKraft" },
  { keywords: ["roshni mehndi", "mehndi art", "mehndi", "mehendi", "henna", "mehndi cone"], categoryName: "Homemade Business", subcategoryName: "Roshni's Mehndi Art" },
  { keywords: ["satyam xerox", "yogesh bhai", "xerox", "photocopy", "printout", "printing", "book stock"], categoryName: "Homemade Business", subcategoryName: "Printing & Xerox" },
  { keywords: ["shiprocket", "courier", "shipment", "parcel", "speed post", "shipping charge", "porter", "shree mahavir", "mahavir courier", "shree nandan", "nandan courier", "shree maruti", "maruti courier", "india post"], categoryName: "Homemade Business", subcategoryName: "Courier & Shipping" },
  { keywords: ["raw material", "stock buy", "material buy"], categoryName: "Homemade Business", subcategoryName: "Raw Materials" },
  { keywords: ["stationery", "office stationery", "business document"], categoryName: "Homemade Business", subcategoryName: "Stationery & Office" },

  // Personal
  { keywords: ["salon", "haircut", "barber", "grooming"], categoryName: "Personal", subcategoryName: "Grooming" },
  { keywords: ["hobby", "hobbies"], categoryName: "Personal", subcategoryName: "Hobbies" },
  { keywords: ["facebook ads", "instagram ads", "meta ads", "google ads", "marketing", "advertising", "promotion"], categoryName: "Personal", subcategoryName: "Advertising & Marketing" },
];

/** Finds the first keyword rule whose keyword appears in the (already-lowercased) text. */
export function matchKeywordRule(text: string): KeywordRule | null {
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule;
  }
  return null;
}
