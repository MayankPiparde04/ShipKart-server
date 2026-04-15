/** Analytics and quality scoring utilities */

import { clamp, toFixedNumber } from '../utils/numbers.js';

const calculateOverallPackingScore = (results) => {
  if (!results?.length) return 0;

  const averageScore =
    results.reduce((sum, result) => {
      const volumeEfficiency = clamp(Number(result?.efficiency?.volumeEfficiency || 0), 0, 100);
      const rawSpaceUtilization = Number(result?.efficiency?.spaceUtilization || 0);
      const spaceUtilization = clamp(
        rawSpaceUtilization > 1 ? rawSpaceUtilization : rawSpaceUtilization * 100,
        0,
        100,
      );
      const weightUtilization = clamp(Number(result?.efficiency?.weightUtilization || 0), 0, 100);
      const wastePercentage = clamp(
        (Number(result?.packingMetrics?.wasteSpace || 0) / Math.max(Number(result?.cartonDetails?.volume || 0), 1)) * 100,
        0,
        100,
      );

      const scoreForCarton =
        (volumeEfficiency * 0.6 +
        spaceUtilization * 0.25 +
        weightUtilization * 0.1 +
        (100 - wastePercentage) * 0.05) / 1.0;

      return sum + scoreForCarton;
    }, 0) / results.length;

  return toFixedNumber(clamp(averageScore, 0, 100));
};

const calculateWasteAnalysis = (results) => {
  const totalWaste = results.reduce((sum, r) => sum + (r.packingMetrics?.wasteSpace || 0), 0);
  const totalVolume = results.reduce((sum, r) => sum + (r.cartonDetails?.volume || 0), 0);
  const wastePercentage = totalVolume > 0 ? (totalWaste / totalVolume) * 100 : 0;

  return {
    totalWasteVolume: toFixedNumber(totalWaste),
    wastePercentage: toFixedNumber(wastePercentage),
    recommendation: wastePercentage > 20 ? 'Consider consolidating items' : null,
  };
};

const calculateStackingAnalysis = (results) => {
  const totalLayers = results.reduce((sum, r) => sum + (r.layout?.layers || 1), 0);
  const avgLayers = results.length > 0 ? totalLayers / results.length : 0;

  return {
    averageLayers: toFixedNumber(avgLayers),
    totalLayers,
    cartonCount: results.length,
  };
};

const estimateCarbonFootprint = (results) => {
  const totalWeight = results.reduce((sum, r) => {
    const itemWeight = (r.itemsPacked * r.packingMetrics?.weightUtilized * r.cartonDetails?.maxWeight) / 100;
    return sum + itemWeight;
  }, 0);
  const cartonFootprint = results.length * 0.2;
  return toFixedNumber((totalWeight * 0.5 + cartonFootprint));
};

export {
  calculateOverallPackingScore,
  calculateWasteAnalysis,
  calculateStackingAnalysis,
  estimateCarbonFootprint,
};
