export interface DefaultCardItem {
  custom_name: string;
  issuer_name: string;
  card_type: "credit" | "debit" | "prepaid";
}

export const DEFAULT_HOUSEHOLD_CARDS: DefaultCardItem[] = [
  { custom_name: "Axis Amex", issuer_name: "Axis Bank", card_type: "credit" },
  { custom_name: "Axis Flipkart", issuer_name: "Axis Bank", card_type: "credit" },
  { custom_name: "Axis MyZone", issuer_name: "Axis Bank", card_type: "credit" },
  { custom_name: "Flipkart SBI", issuer_name: "State Bank of India", card_type: "credit" },
  { custom_name: "HDFC Millennia", issuer_name: "HDFC Bank", card_type: "credit" },
  { custom_name: "HDFC Swiggy", issuer_name: "HDFC Bank", card_type: "credit" },
  { custom_name: "HDFC Tata Neu Card", issuer_name: "HDFC Bank", card_type: "credit" },
  { custom_name: "ICICI Coral Rupay", issuer_name: "ICICI Bank", card_type: "credit" },
  { custom_name: "ICICI Platinum", issuer_name: "ICICI Bank", card_type: "credit" },
  { custom_name: "Kotak Card", issuer_name: "Kotak Mahindra Bank", card_type: "credit" },
  { custom_name: "SBI Cashback", issuer_name: "State Bank of India", card_type: "credit" },
  { custom_name: "SBI Simply Click", issuer_name: "State Bank of India", card_type: "credit" },
  { custom_name: "SBI Simply Click [Roshni]", issuer_name: "State Bank of India", card_type: "credit" },
  { custom_name: "Scapia BOB Credit Card", issuer_name: "Scapia", card_type: "credit" },
];
