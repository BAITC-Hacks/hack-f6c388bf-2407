export type Domain = 'transport' | 'ecology' | 'social' | 'safety' | 'services';
export type DistrictId = 'esil' | 'almaty' | 'saryarka' | 'baikonur' | 'nura';
export type IndicatorCode = 'T1' | 'T2' | 'E1' | 'E2' | 'S1' | 'S2' | 'B1' | 'B2' | 'C1' | 'C2';
export interface Decision { initiative_id: string; district_id?: DistrictId }
export interface Initiative {
  id: string; domain: Domain; name_ru: string; scope: 'district' | 'citywide';
  cost: number; lag_quarters: number; effects: Partial<Record<IndicatorCode, number>>;
}
export interface DistrictCatalogItem {
  id: DistrictId; name_ru: string; population_share: number; profile_ru: string;
  indicators: Record<IndicatorCode, number>;
}
export interface District extends DistrictCatalogItem {
  score: number; baseline_score: number; delta: number;
  before: Record<IndicatorCode, number>; after: Record<IndicatorCode, number>;
}
export interface Analysis { summary: string; strengths: string[]; risks: string[]; tradeoffs: string[]; recommendations: string[] }
export interface TimelinePoint { quarter: number; score: number; score_delta: number; domain_metrics: Record<Domain, number> }
export interface WhatIf { projected_score: number; score_change: number }
export interface OptimizedScenario { kind: string; decisions: Decision[]; score: number; fairness_index: number; budget: Metrics['budget'] }
export interface StressResponse {
  id: string; name_ru: string; cost: number; description_ru: string; available: boolean;
  score?: number; score_delta?: number; fairness_index?: number; critical_pairs?: number; budget?: Metrics['budget'];
}
export interface Metrics {
  budget: { total: number; spent: number; remaining: number };
  baseline_score: number; score_delta: number; city_score: number;
  weakest_district: { district_id: DistrictId; score: number };
  critical_pairs: number; critical_indicators: { district_id: DistrictId; indicator: IndicatorCode; value: number }[];
  districts: District[]; domain_metrics: Record<Domain, number>;
  fairness_index: number; district_gap: number;
  score_breakdown: { city_component: number; weakest_component: number; critical_penalty: number };
  synergies: { initiatives: string[]; indicator: IndicatorCode; value: number; district_id: DistrictId }[];
}
export interface Preview extends Metrics {
  projected_score: number; complete: boolean;
  timeline: TimelinePoint[];
  what_if: Record<string, Record<string, WhatIf | null>>;
  availability: Record<string, Record<string, string | null>>;
  replacement_availability: Record<string, Record<string, string | null>>;
}
export interface ScenarioResult extends Metrics {
  valid: true; score: number; ai_analysis: Analysis | null;
  ai_status: 'disabled' | 'available' | 'unavailable'; model_analysis: Analysis;
  timeline: TimelinePoint[];
  strategy_title: string;
  stress_test: { id: string; title_ru: string; description_ru: string; seed: string; responses: StressResponse[] };
  optimization: { max_score: OptimizedScenario; balanced: OptimizedScenario; best_swap: (OptimizedScenario & { gain: number; removed_id: string | null; added_id: string | null }) | null };
}
export interface Catalog {
  budget: number; horizon_quarters: number; districts: DistrictCatalogItem[];
  indicators: { code: IndicatorCode; domain: Domain; name_ru: string; description_ru: string }[];
  initiatives: Initiative[]; baseline_result: Preview;
  rules: { required_decision_count: number; max_per_domain: number; incompatible_pairs: { initiatives: string[]; scope: string; reason_ru: string }[] };
}
