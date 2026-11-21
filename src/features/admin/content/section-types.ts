export type SectionType = "hero" | "category_grid" | "product_rail" | "editorial" | "newsletter";

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Hero (büyük görsel + başlık)",
  category_grid: "Kategori ızgarası",
  product_rail: "Ürün vitrini",
  editorial: "Editoryal / marka hikâyesi",
  newsletter: "Bülten kaydı",
};
