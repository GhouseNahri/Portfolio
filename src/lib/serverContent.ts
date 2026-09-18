// Server-side access to the live site data for the admin API routes.
// In production the data file is bundled with the serverless function —
// a static import (evaluated once per warm instance) is the reliable
// pattern there. Freshness across publishes comes from the rebuild:
// publishing to main triggers a new deployment whose function bundles
// the NEW site.ts. The dev server re-reads with a cache-busting query.

import { site, about, skills, projects, education } from "../data/site";
import type { SiteState } from "./siteGenerator";

export function currentSiteState(): SiteState {
  // Deep-copy so route handlers can mutate freely without touching the
  // module singleton (warm serverless instances reuse it across requests).
  return JSON.parse(
    JSON.stringify({ site, about, skills, projects, education })
  ) as SiteState;
}
