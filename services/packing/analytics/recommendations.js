/** Recommendation engine for packing optimization */

import { getSmallerBoxRecommendation, buildOptimizationTip } from './index.js';

const generatePackingRecommendations = (results, unpackedProducts, cartons, products, volumeEfficiency, optimizationTip) => {
  const recommendations = [];

  if (unpackedProducts?.length > 0) {
    recommendations.push(`${unpackedProducts.length} items could not be packed. Check inventory or item size.`);
  }

  if (volumeEfficiency < 50) {
    recommendations.push('Volume efficiency is low. Consider using smaller cartons.');
  }

  const inefficientPacks = results.filter((r) => r.efficiency.spaceUtilization < 0.5);
  if (inefficientPacks.length > 0) {
    recommendations.push(
      `${inefficientPacks.length} cartons have <50% space utilization. Use smaller boxes.`,
    );
  }

  if (optimizationTip) {
    recommendations.push(optimizationTip);
  }

  return recommendations;
};

export {
  generatePackingRecommendations,
  getSmallerBoxRecommendation,
  buildOptimizationTip,
};
