// Fix guides for AEO, GEO and Brand checks (aeo.*, geo.*, brand.*). Keyed by check id.
// The guides live in ./ai/*: answers (aeo), ready (geo website checks), business (brand website checks),
// results (AI answer checks); shared.ts and org.ts hold per-platform building blocks.
import type { FixGuide } from "../types";
import {
  contentDepthGuide, directAnswersGuide, faqSchemaGuide, listsTablesGuide, questionHeadingsGuide, readabilityGuide,
  structuredDataGuide,
} from "./ai/answers";
import {
  aiSearchAccessGuide, authorSignalsGuide, citedSourcesGuide, entityClarityGuide, freshnessGuide, llmsTxtGuide,
  quotableFactsGuide,
} from "./ai/ready";
import {
  aboutPageGuide, contactInfoGuide, nameConsistencyGuide, organizationSchemaGuide, privacyPolicyGuide, socialProfilesGuide,
} from "./ai/business";
import { aiCitationRateGuide, aiKnowledgeGuide, aiMentionRateGuide, aiRecommendationGuide, competitorShareGuide } from "./ai/results";

export const AI_GUIDES: Record<string, FixGuide> = {
  "aeo.content_depth": contentDepthGuide,
  "aeo.direct_answers": directAnswersGuide,
  "aeo.faq_schema": faqSchemaGuide,
  "aeo.lists_tables": listsTablesGuide,
  "aeo.question_headings": questionHeadingsGuide,
  "aeo.readability": readabilityGuide,
  "aeo.structured_data": structuredDataGuide,
  "geo.ai_search_access": aiSearchAccessGuide,
  "geo.llms_txt": llmsTxtGuide,
  "geo.quotable_facts": quotableFactsGuide,
  "geo.cited_sources": citedSourcesGuide,
  "geo.freshness": freshnessGuide,
  "geo.author_signals": authorSignalsGuide,
  "geo.entity_clarity": entityClarityGuide,
  "geo.ai_mention_rate": aiMentionRateGuide,
  "geo.ai_citation_rate": aiCitationRateGuide,
  "geo.competitor_share": competitorShareGuide,
  "brand.about_page": aboutPageGuide,
  "brand.contact_info": contactInfoGuide,
  "brand.name_consistency": nameConsistencyGuide,
  "brand.organization_schema": organizationSchemaGuide,
  "brand.privacy_policy": privacyPolicyGuide,
  "brand.social_profiles": socialProfilesGuide,
  "brand.ai_recommendation": aiRecommendationGuide,
  "brand.ai_knowledge": aiKnowledgeGuide,
};
