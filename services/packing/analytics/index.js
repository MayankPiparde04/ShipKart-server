/** Placeholder stubs for larger recommendation functions */

const getSmallerBoxRecommendation = (products, cartons, results, efficiency) => {
  return efficiency < 60 ? 'Consider using medium or small cartons for better efficiency.' : null;
};

const buildOptimizationTip = (products, cartons, results, packer) => {
  return results?.length > 5 ? `Optimize: Consider consolidating into fewer cartons.` : null;
};

export { getSmallerBoxRecommendation, buildOptimizationTip };
