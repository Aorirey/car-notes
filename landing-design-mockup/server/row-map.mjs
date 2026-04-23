/** @param {Record<string, unknown>} row */
export function rowToCar(row) {
  return {
    id: row.id,
    title: row.title,
    createdAt: new Date(row.created_at).getTime(),
    linkUrl: row.link_url ?? "",
    legalStatus: row.legal_status ?? "",
    electrical: row.electrical ?? "",
    rustWhere: row.rust_where ?? "",
    rustDegree: row.rust_degree ?? "",
    chipsWhere: row.chips_where ?? "",
    chipsDamage: row.chips_damage ?? "",
    damaged: row.damaged ?? "",
    dentsWhere: row.dents_where ?? "",
    dentsDamage: row.dents_damage ?? "",
    repaintWhere: row.repaint_where ?? "",
    repaintDegree: row.repaint_degree ?? "",
    generalCondition: row.general_condition ?? "",
    desc1: row.desc1 ?? "",
    desc2: row.desc2 ?? "",
    desc3: row.desc3 ?? "",
  };
}

/** Карта полей JSON (camelCase) → колонки SQL */
export const PATCH_COLUMN_MAP = {
  title: "title",
  linkUrl: "link_url",
  legalStatus: "legal_status",
  electrical: "electrical",
  rustWhere: "rust_where",
  rustDegree: "rust_degree",
  chipsWhere: "chips_where",
  chipsDamage: "chips_damage",
  damaged: "damaged",
  dentsWhere: "dents_where",
  dentsDamage: "dents_damage",
  repaintWhere: "repaint_where",
  repaintDegree: "repaint_degree",
  generalCondition: "general_condition",
  desc1: "desc1",
  desc2: "desc2",
  desc3: "desc3",
};
