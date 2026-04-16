/** Main packing service orchestrator - coordinates modular components */

import {
  toFixedNumber,
  safeSum,
  canFitInAnyOrientation,
  getLargestAvailableCarton,
  FRAGILE_HANDLING_SURCHARGE,
} from './utils/index.js';
import { estimateCarbonFootprint } from './analytics/quality.js';
import { generatePackingRecommendations } from './analytics/recommendations.js';
import Advanced3DBinPacker from './algorithms/binPacker.js';

const validatePackingInputs = (availableBoxes, productArray) => {
  if (!availableBoxes.length) throw new Error('No boxes found in inventory.');

  const totalInventoryUnits = safeSum(
    availableBoxes,
    (box) => Math.max(0, Number.parseInt(box.availableQuantity, 10) || 0),
  );
  if (totalInventoryUnits <= 0) throw new Error('Insufficient inventory. No boxes available in stock.');

  if (productArray.length === 0) throw new Error('No products provided.');

  for (const product of productArray) {
    const qty = Number(product?.quantity || 0);
    const [len, brd, hgt] = [product?.length, product?.breadth, product?.height].map((n) => Number(n || 0));
    if (qty <= 0 || len <= 0 || brd <= 0 || hgt <= 0) {
      throw new Error(`Invalid dimensions for product: ${product?.name || 'Unknown'}`);
    }
  }

  const largestCarton = getLargestAvailableCarton(availableBoxes);
  if (!largestCarton) throw new Error('No boxes found in inventory.');

  const incompatible = productArray.find(
    (product) => !canFitInAnyOrientation(product, largestCarton),
  );
  if (incompatible) throw new Error('Item is too large for any available carton.');
};

/**
 * Calculate optimal packing for products into available cartons
 * @param {Array} products - Product instances
 * @param {Array} cartons - Carton instances
 * @param {Object} options - Algorithm and optimization flags
 * @returns {Object} Packing results with analytics
 */
const calculateOptimalPacking = (products, cartons, options = {}) => {
  const { algorithm = 'hybrid' } = options;

  const packer = new Advanced3DBinPacker();

  const availableBoxes = Array.isArray(cartons) ? cartons.filter(Boolean) : [];
  const productArray = (Array.isArray(products) ? products : [products]).sort(
    (a, b) => (b.weightPerUnitKg || 0) - (a.weightPerUnitKg || 0),
  );
  validatePackingInputs(availableBoxes, productArray);

  // Work with carton copies
  const workingCartons = availableBoxes.map((carton, index) => ({
    ...carton,
    originalIndex: index,
    availableQuantity: Math.max(0, Number.parseInt(carton.availableQuantity, 10) || 0),
  }));

  // Pack products
  const allResults = [];
  const unpackedProducts = [];

  for (const product of productArray) {
    const packingResults = packer.packItems([{ ...product }], workingCartons, algorithm);
    allResults.push(...packingResults);

    const totalPacked = safeSum(allResults, (r) => r.itemsPacked || 0);
    if (totalPacked < product.quantity) {
      unpackedProducts.push(product);
    }
  }

  // Calculate totals
  const totalItemsPacked = safeSum(allResults, (r) => r.itemsPacked);
  const totalRequested = safeSum(productArray, (p) => p.quantity);
  const totalCartonsUsed = allResults.length;

  const totalWeightGrams = safeSum(allResults, (r) => (r.itemsPacked || 0) * (r.unitWeightGrams || 0));
  const totalWeightKg = totalWeightGrams / 1000;

  // Cost breakdown
  const usedBoxPriceTotal = safeSum(
    allResults,
    (r) => r.cost?.breakdown?.boxPrice || r.cost?.breakdown?.cartonCost || 0,
  );
  const handlingFeeTotal = safeSum(
    allResults,
    (r) => r.cost?.breakdown?.handlingFeePerBox || r.cost?.breakdown?.handlingFee || 0,
  );
  const fragileHandlingSurcharge = productArray.some((p) => p.isFragile)
    ? FRAGILE_HANDLING_SURCHARGE
    : 0;
  const estimatedCost = usedBoxPriceTotal + handlingFeeTotal + fragileHandlingSurcharge;
  const totalCost = toFixedNumber(estimatedCost);

  // Analytics
  const analytics = {
    recommendations: generatePackingRecommendations(
      allResults,
      unpackedProducts,
      cartons,
      productArray,
      null,
    ),
    sustainability: {
      totalWasteVolume: toFixedNumber(
        allResults.reduce((sum, r) => sum + (r.packingMetrics?.wasteSpace || 0), 0),
      ),
      carbonFootprint: toFixedNumber(estimateCarbonFootprint(allResults)),
    },
  };

  return {
    packingResults: allResults,
    unpackedProducts,
    remainingQuantity: totalRequested - totalItemsPacked,
    summary: {
      totalItemsRequested: totalRequested,
      totalItemsPacked,
      totalCartonsUsed,
      packingSuccess: unpackedProducts.length === 0,
      packingRate: toFixedNumber((totalItemsPacked / totalRequested) * 100),
      totalCost,
      totalWeightKg: toFixedNumber(totalWeightKg),
      estimatedCost: {
        total: toFixedNumber(estimatedCost),
        breakdown: {
          usedBoxPriceTotal: toFixedNumber(usedBoxPriceTotal),
          handlingFeeTotal: toFixedNumber(handlingFeeTotal),
          fragileHandlingSurcharge: toFixedNumber(fragileHandlingSurcharge),
          cartonBaseCost: toFixedNumber(usedBoxPriceTotal),
          shippingRatePerKg: 0,
          shippingCostByWeight: 0,
          fragileHandlingFee: toFixedNumber(fragileHandlingSurcharge),
        },
      },
    },
    analytics,
  };
};

export { calculateOptimalPacking };
export { default as Product } from './models/Product.js';
export { default as Carton } from './models/Carton.js';
export { default as Position3D } from './models/Position3D.js';
export { default as PackedItem } from './models/PackedItem.js';
