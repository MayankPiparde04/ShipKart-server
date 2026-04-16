/** Recommendation engine for packing optimization */

const generatePackingRecommendations = (results, unpackedProducts, cartons, products, optimizationTip) => {
  const recommendations = [];

  if (unpackedProducts?.length > 0) {
    recommendations.push(`${unpackedProducts.length} items could not be packed. Check inventory or item size.`);
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
};

export {
  getSmallerBoxRecommendation,
  buildOptimizationTip,
} from './index.js';
