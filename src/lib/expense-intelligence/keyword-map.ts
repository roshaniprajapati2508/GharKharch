// Static keyword -> category/subcategory fallback used by the category
// suggester's tier 4 (spec section 19, keyword matching) when a household has
// no usage history yet for an item. Matched against the seeded global
// category tree (migration 004/008) by NAME, never by id, since ids are
// generated at insert time and differ per environment.
//
// This is intentionally a *fallback*, not a source of truth: any household
// usage (exact item/merchant pattern) always outranks it (see
// category-suggester.ts). Keep entries mapped to real seeded names only.

import { fuzzyMatches } from "./fuzzy-match";

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
  { keywords: ["maid", "kamvali", "bai", "cook", "maharaj", "car wash", "dhobi", "safai", "sweeper", "cleaning lady", "house help"], categoryName: "Household", subcategoryName: "Maid & Domestic Help" },
  { keywords: ["pooja", "puja", "agarbatti", "dhoop", "diya oil", "phool", "prasad", "mandir", "daan", "temple", "pooja samagri", "havan", "garland", "chandan", "kapoor"], categoryName: "Household", subcategoryName: "Pooja & Spiritual" },
  { keywords: ["society maintenance", "maintenance fee", "maintenance bill", "society bill", "rwa bill", "building maintenance", "society charge"], categoryName: "Household", subcategoryName: "Society Maintenance" },
  { keywords: ["cleaning", "detergent", "soap", "dishwash", "harpic", "surf excel", "ariel", "vim"], categoryName: "Household", subcategoryName: "Cleaning" },
  { keywords: ["utensil", "cookware", "kitchenware", "bartan"], categoryName: "Household", subcategoryName: "Kitchen" },
  { keywords: ["furniture", "sofa", "bed", "table", "chair", "mattress"], categoryName: "Household", subcategoryName: "Furniture" },
  { keywords: ["decor", "curtain", "lamp", "cushion", "bedsheet"], categoryName: "Household", subcategoryName: "Home Decor" },
  { keywords: ["repair", "plumber", "electrician", "maintenance", "urban company", "urbanclap", "ac service", "carpenter"], categoryName: "Household", subcategoryName: "Maintenance" },

  // Income & Marketplace Payouts (High Priority so Payouts & Book Sales match Business Sales / Homemade Business)
  { keywords: ["flipkart seller", "amazon seller", "meesho seller", "seller payout", "payout", "marketplace payout", "website orders", "website order", "book payout", "books payout", "seller payout books", "book sale", "book sales", "bridal mehndi", "mehndi booking", "mehndi client"], categoryName: "Business Sales & Payouts" },
  { keywords: ["salary", "payroll", "monthly salary", "salary credit"], categoryName: "Salary" },
  { keywords: ["freelance", "freelancing", "consulting", "client payment", "project payout", "web dev"], categoryName: "Freelancing & Consulting" },

  // Homemade Business
  { keywords: ["meta ads", "facebook ads", "instagram ads", "fb ads", "google ads", "ad spend", "ads", "advertisement", "advertising", "marketing", "promotion", "ad campaign"], categoryName: "Homemade Business", subcategoryName: "Advertising & Marketing" },
  { keywords: ["packaging", "packaging box", "corrugated box", "bubble wrap", "courier bag", "packing tape", "brown tape", "shipping label", "fragile tape", "packaging material", "parcel box"], categoryName: "Homemade Business", subcategoryName: "Packaging & Shipping Supplies" },
  { keywords: ["luxekraft", "craft material", "craft raw material", "mobile cover", "phone cover", "mobile case", "blank cover", "blank case", "cover stock", "sublimation case", "acrylic cover", "resin", "epoxy"], categoryName: "Homemade Business", subcategoryName: "LuxeKraft" },
  { keywords: ["roshni mehndi", "mehndi art", "mehndi", "mehendi", "henna", "mehndi cone", "mehndi books", "mehndi book", "henna book", "nilgiri", "eucalyptus oil", "cajeput", "acrylic practice hand", "cone sheet", "cello cone"], categoryName: "Homemade Business", subcategoryName: "Roshni's Mehndi Art" },
  { keywords: ["satyam xerox", "yogesh bhai", "xerox", "photocopy", "printout", "printing", "book stock", "book printing", "binding", "spiral binding", "laminating"], categoryName: "Homemade Business", subcategoryName: "Printing & Xerox" },
  { keywords: ["shiprocket", "courier", "shipment", "parcel", "speed post", "shipping charge", "porter", "shree mahavir", "mahavir courier", "shree nandan", "nandan courier", "shree maruti", "maruti courier", "india post", "delhivery", "dtdc", "bluedart"], categoryName: "Homemade Business", subcategoryName: "Courier & Shipping" },
  { keywords: ["raw material", "stock buy", "material buy"], categoryName: "Homemade Business", subcategoryName: "Raw Materials" },
  { keywords: ["stationery", "office stationery", "business document", "shopify", "godaddy", "domain renewal", "hosting", "canva pro"], categoryName: "Homemade Business", subcategoryName: "Stationery & Office" },

  // Shopping
  { keywords: ["shopping", "amazon", "flipkart", "myntra", "meesho", "ajio", "nykaa", "tata cliq", "online shopping", "e-commerce", "shopping mall", "general shopping", "bazaar", "bazar", "market", "mall", "purchase", "order"], categoryName: "Shopping", subcategoryName: "Online Shopping" },
  { keywords: ["novel", "magazine", "reading book", "book buy"], categoryName: "Shopping", subcategoryName: "General Shopping" },

  // Personal
  { keywords: ["tuition", "coaching", "school fee", "college fee", "class fee", "exam fee", "tuition fee", "course fee", "study material"], categoryName: "Personal", subcategoryName: "Education & Tuition" },
  { keywords: ["salon", "haircut", "barber", "grooming", "parlour", "spa"], categoryName: "Personal", subcategoryName: "Grooming" },
  { keywords: ["hobby", "hobbies"], categoryName: "Personal", subcategoryName: "Hobbies" },
];

/** Finds the first keyword rule whose keyword appears in the text (case-insensitive). */
export function matchKeywordRule(text: string): KeywordRule | null {
  if (typeof text !== "string") return null;
  const lower = text.toLowerCase().trim();
  if (!lower) return null;

  // Exact/substring pass first - cheap, and correctly-spelled text should
  // never need the fuzzy fallback below.
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((k) => lower.includes(k.toLowerCase()))) return rule;
  }

  // Typo-tolerant fallback pass (fuzzy typo tolerance, e.g. "docter" for
  // "doctor", "xrox" for "xerox") - only reached when nothing matched
  // exactly, and only for text that's substantial enough to be worth it.
  if (lower.length < 3) return null;
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((k) => fuzzyMatches(lower, k.toLowerCase()))) return rule;
  }

  return null;
}
