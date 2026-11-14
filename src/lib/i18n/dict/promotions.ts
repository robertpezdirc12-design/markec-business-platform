// ============================================================
// F5.1 — POPUSTI IN PROMOCIJE (slovenski + angleški imenski prostor)
// ============================================================

export const promotionsSl = {
  nav: "Popusti in promocije",
  title: "Popusti in",
  titleAccent: "promocije",
  subtitle: "Ustvarjajte in upravljajte popuste ter promocijske akcije za svojo ponudbo.",
  addPromotion: "Nova promocija",
  addPromotionShort: "Nova",
  noPromotions: "Ni še nobene promocije.",
  noPromotionsDesc:
    "Ustvarite prvo promocijo, da strankam ponudite popust na storitve, izdelke ali celotno ponudbo.",
  createFirst: "Ustvari prvo promocijo",

  // Stat cards
  totalPromotions: "Vse promocije",
  activePromotions: "Aktivne zdaj",
  totalRedemptions: "Skupno uporab",
  totalDiscountGiven: "Skupaj popust",

  // List columns
  colPromotion: "Promocija",
  colType: "Vrsta popusta",
  colValidity: "Veljavnost",
  colUses: "Uporabe",
  colStatus: "Status",
  colActions: "Dejanja",
  noDescription: "Brez opisa",

  // Lifecycle badges
  lifecycleActive: "Aktivna",
  lifecycleScheduled: "Razporejena",
  lifecycleExpired: "Potekla",
  lifecycleDraft: "Osnutek",
  lifecycleInactive: "Neaktivna",

  // Discount type / scope labels
  percentOff: "odstotni popust",
  fixedOff: "fiksni popust",
  scopeWhole: "Celotna ponudba",
  scopeProducts: "Izbrani izdelki",
  scopeServices: "Izbrane storitve",
  scopeCategories: "Izbrane kategorije",
  allProducts: "Vsi izdelki",
  allServices: "Vse storitve",

  // Codes
  noCode: "Brez kode (samodejno)",
  codeLabel: "Promocijska koda",
  codeUsedBadge: "S kodo",
  // Shareable link / QR
  shareTitle: "Deli kodo s povezavo",
  shareDescription:
    "Povezava odpre vašo javno stran in kodo samodejno vnese v košarico.",
  copyLink: "Kopiraj povezavo",
  linkCopied: "Povezava je kopirana.",
  linkCopiedShort: "Kopirano",

  // Usage
  usesOf: "od",
  unlimited: "neomejeno",

  // Actions
  edit: "Uredi",
  activate: "Aktiviraj",
  deactivate: "Deaktiviraj",
  delete: "Izbriši",
  deleteConfirm: "Ali res želite izbrisati to promocijo? Zgodovina uporab ostane ohranjena na naročilih in terminih.",
  viewRedemptions: "Pregled uporab",

  // Create / edit form
  formTitleNew: "Ustvari promocijo",
  formTitleEdit: "Uredi promocijo",
  name: "Ime promocije",
  namePlaceholder: "npr. Poletni popust",
  nameHelp: "Vidno ime, po katerem boste promocijo prepoznali.",
  description: "Opis",
  descriptionPlaceholder: "Kaj promocija ponuja? (ni obvezno)",
  discountType: "Vrsta popusta",
  discountTypePercent: "Odstotni popust (%)",
  discountTypeFixed: "Fiksni znesek (€)",
  discountValuePercent: "Višina popusta",
  discountValueFixed: "Višina popusta (€)",
  discountValueHelpPercent: "Koliko odstotkov odštejete od cene (0–100).",
  discountValueHelpFixed: "Koliko evrov odštejete od skupne vsote.",
  scope: "Na kaj se popust nanaša",
  scopeHelp:
    "Izberite, na kaj velja popust — na celotno ponudbo, na izbrane izdelke, na izbrane storitve ali na kategorije.",
  targets: "Izberite ciljne entitete",
  targetsHelp:
    "Pustite prazno za VSE (če obseg omogoča). Držite Ctrl/Cmd za večkratno izbiro.",
  code: "Promocijska koda",
  codePlaceholder: "npr. POLE TJE20",
  codeHelp: "Če vnesete kodo, mora stranka ob plačilu vnesti točno to kodo.",
  generateCode: "Generiraj kodo",
  startsAt: "Začetek veljavnosti",
  endsAt: "Konec veljavnosti",
  startsAtHelp: "Prazno = začne takoj.",
  endsAtHelp: "Prazno = ne poteče.",
  maxRedemptions: "Omejitev skupnega števila uporab",
  maxRedemptionsHelp: "Prazno = neomejeno.",
  maxPerCustomer: "Omejitev na eno stranko",
  maxPerCustomerHelp: "Kolikokrat ena stranka sme uporabiti popust. Prazno = neomejeno.",
  minOrderValue: "Minimalna vrednost naročila (€)",
  minOrderValueHelp: "Popust velja le, če je vsota naročila vsaj toliko. Prazno = brez pogoja.",
  status: "Stanje",
  statusDraft: "Osnutek",
  statusActive: "Aktivna",
  statusInactive: "Neaktivna",
  statusHelp:
    "Osnutek se ne uporablja. Aktivna se takoj upošteva pri naročilu/rezervaciji.",
  save: "Shrani promocijo",
  saving: "Shranjevanje …",
  cancel: "Prekliči",
  back: "Nazaj na seznam",

  // Delete / status feedback
  saved: "Promocija je shranjena.",
  deleted: "Promocija je izbrisana.",
  statusUpdated: "Stanje promocije je posodobljeno.",

  // Usage / redemptions page
  redemptionsTitle: "Uporabe promocije",
  noRedemptions: "Ta promocija še ni bila uporabljena.",
  customer: "Stranka",
  guestEmail: "Gost / e-pošta",
  orderRef: "Naročilo / termin",
  discountAmount: "Odštet znesek",
  baseAmount: "Osnova",
  redeemedAt: "Uporabljeno",
  uses: "uporab",
  usedCountFormat: "{used} od {limit}",
  totalRedeemed: "Skupaj odšteto",

  // Validation errors
  errNameRequired: "Ime promocije je obvezno.",
  errValueRequired: "Vnesite vrednost popusta.",
  errInvalidCode: "Koda je neveljavna.",
  errDateRange: "Konec veljavnosti ne sme biti pred začetkom.",
}

export type PromotionsDict = typeof promotionsSl

export const promotionsEn: PromotionsDict = {
  nav: "Discounts & promotions",
  title: "Discounts &",
  titleAccent: "promotions",
  subtitle: "Create and manage discounts and promotional campaigns for your offer.",
  addPromotion: "New promotion",
  addPromotionShort: "New",
  noPromotions: "No promotions yet.",
  noPromotionsDesc:
    "Create your first promotion to offer customers a discount on services, products or your whole offer.",
  createFirst: "Create your first promotion",

  totalPromotions: "All promotions",
  activePromotions: "Active now",
  totalRedemptions: "Total uses",
  totalDiscountGiven: "Total discount given",

  colPromotion: "Promotion",
  colType: "Discount type",
  colValidity: "Validity",
  colUses: "Uses",
  colStatus: "Status",
  colActions: "Actions",
  noDescription: "No description",

  lifecycleActive: "Active",
  lifecycleScheduled: "Scheduled",
  lifecycleExpired: "Expired",
  lifecycleDraft: "Draft",
  lifecycleInactive: "Inactive",

  percentOff: "percent off",
  fixedOff: "fixed amount off",
  scopeWhole: "Whole offer",
  scopeProducts: "Selected products",
  scopeServices: "Selected services",
  scopeCategories: "Selected categories",
  allProducts: "All products",
  allServices: "All services",

  noCode: "No code (automatic)",
  codeLabel: "Promo code",
  codeUsedBadge: "With code",
  shareTitle: "Share the code with a link",
  shareDescription:
    "The link opens your public page and auto-applies the code to the cart.",
  copyLink: "Copy link",
  linkCopied: "Link copied.",
  linkCopiedShort: "Copied",

  usesOf: "of",
  unlimited: "unlimited",

  edit: "Edit",
  activate: "Activate",
  deactivate: "Deactivate",
  delete: "Delete",
  deleteConfirm: "Are you sure you want to delete this promotion? Usage history is preserved on orders and appointments.",
  viewRedemptions: "View uses",

  formTitleNew: "Create promotion",
  formTitleEdit: "Edit promotion",
  name: "Promotion name",
  namePlaceholder: "e.g. Summer discount",
  nameHelp: "A visible name you will recognise the promotion by.",
  description: "Description",
  descriptionPlaceholder: "What does this promotion offer? (optional)",
  discountType: "Discount type",
  discountTypePercent: "Percentage off (%)",
  discountTypeFixed: "Fixed amount (€)",
  discountValuePercent: "Discount amount",
  discountValueFixed: "Discount amount (€)",
  discountValueHelpPercent: "How many percent is taken off the price (0–100).",
  discountValueHelpFixed: "How many euros are taken off the total.",
  scope: "What the discount applies to",
  scopeHelp:
    "Choose what the discount applies to — the whole offer, selected products, selected services, or categories.",
  targets: "Select target entities",
  targetsHelp: "Leave empty for ALL (when the scope allows). Hold Ctrl/Cmd to select multiple.",
  code: "Promo code",
  codePlaceholder: "e.g. SUMMER20",
  codeHelp: "If you enter a code, the customer must enter the exact code at checkout.",
  generateCode: "Generate code",
  startsAt: "Valid from",
  endsAt: "Valid until",
  startsAtHelp: "Empty = starts immediately.",
  endsAtHelp: "Empty = never expires.",
  maxRedemptions: "Total use limit",
  maxRedemptionsHelp: "Empty = unlimited.",
  maxPerCustomer: "Limit per customer",
  maxPerCustomerHelp: "How many times one customer may use the discount. Empty = unlimited.",
  minOrderValue: "Minimum order value (€)",
  minOrderValueHelp: "The discount only applies when the order total is at least this. Empty = no condition.",
  status: "Status",
  statusDraft: "Draft",
  statusActive: "Active",
  statusInactive: "Inactive",
  statusHelp:
    "A draft is not used. Active is immediately honoured at checkout/booking.",
  save: "Save promotion",
  saving: "Saving …",
  cancel: "Cancel",
  back: "Back to list",

  saved: "Promotion saved.",
  deleted: "Promotion deleted.",
  statusUpdated: "Promotion status updated.",

  redemptionsTitle: "Promotion uses",
  noRedemptions: "This promotion has not been used yet.",
  customer: "Customer",
  guestEmail: "Guest / email",
  orderRef: "Order / booking",
  discountAmount: "Amount off",
  baseAmount: "Base",
  redeemedAt: "Used on",
  uses: "uses",
  usedCountFormat: "{used} of {limit}",
  totalRedeemed: "Total off",

  errNameRequired: "Promotion name is required.",
  errValueRequired: "Enter the discount value.",
  errInvalidCode: "Invalid code.",
  errDateRange: "End date cannot be before start date.",
}