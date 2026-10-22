import type { RouteResponse } from "./types";

/** Which of the two routes the user picked: the BeeAble (recommended) route or the server's alternative. */
export type RouteChoice = "recommended" | "alternative";

/**
 * The response as the map, card and journey should show it: the chosen route in `recommended`, and the
 * one not chosen in `alternative`, so it is drawn as the other option and can be picked back.
 */
export function chooseRoute(route: RouteResponse, choice: RouteChoice): RouteResponse {
  const alt = route.alternative;
  if (choice !== "alternative" || !alt) return route;
  return {
    ...route,
    recommended: alt.route,
    costs: { ...route.costs, recommended: alt.costs },
    explanation: alt.explanation,
    surveyed_share: alt.surveyed_share,
    alternative: {
      route: route.recommended,
      costs: route.costs.recommended,
      explanation: route.explanation,
      surveyed_share: route.surveyed_share,
    },
  };
}
