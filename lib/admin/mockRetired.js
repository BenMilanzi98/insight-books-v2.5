/**
 * Honest retirement payload for deprecated admin mock endpoints.
 */
export function mockRetiredResponse(featureName) {
  return {
    success: false,
    error: `${featureName} mock endpoint retired. Use real data APIs or empty results.`,
    mockRetired: true,
  };
}
