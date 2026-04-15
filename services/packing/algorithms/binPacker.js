/** Advanced3DBinPacker - Core 3D bin packing algorithm (maintained from main service for stability) */

import { clamp, toFixedNumber, canFitInAnyOrientation, getHandlingFeePerBox, isAxisAlignedOverlap, packedItemsOverlap } from '../utils/index.js';
import Position3D from '../models/Position3D.js';
import PackedItem from '../models/PackedItem.js';

/**
 * Advanced 3D Bin Packing Algorithm Implementation
 * 
 * Supports multiple packing strategies including First Fit Decreasing (FFD),
 * Best Fit Decreasing (BFD), Guillotine partitioning, Skyline tracking, and
 * a Hybrid approach that evaluates multiple algorithms and returns the best result.
 * 
 * Key Features:
 * - 3D spatial layout optimization with multiple orientation support
 * - Constraint handling: weight limits, fragility rules, stacking restrictions
 * - Stability scoring and center-of-mass calculations
 * - Cost analysis with handling fees and surcharges
 * - Comprehensive efficiency metrics including volume and space utilization
 * 
 * @class Advanced3DBinPacker
 */
class Advanced3DBinPacker {
  /**
   * Initialize the packing algorithm with available strategies.
   * 
   * @constructor
   */
  constructor() {
    this.algorithms = {
      FIRST_FIT_DECREASING: 'ffd',
      BEST_FIT_DECREASING: 'bfd',
      GUILLOTINE: 'guillotine',
      SKYLINE: 'skyline',
      HYBRID: 'hybrid',
    };
  }

  /**
   * Main packing orchestration method supporting multiple algorithms.
   * 
   * @param {Array<Object>} products - Array of product objects with dimensions and weight
   * @param {Array<Object>} cartons - Array of available carton/container objects
   * @param {string} [algorithm='hybrid'] - Algorithm selection: 'ffd', 'bfd', 'guillotine', 'skyline', or 'hybrid'
   * @returns {Array<Object>} Array of packing results with efficiency metrics and layout details
   */
  packItems(products, cartons, algorithm = 'hybrid') {
    switch (algorithm) {
      case 'ffd':
        return this.firstFitDecreasing(products, cartons);
      case 'bfd':
        return this.bestFitDecreasing(products, cartons);
      case 'guillotine':
        return this.packWithGuillotine(products, cartons);
      case 'skyline':
        return this.packWithSkyline(products, cartons);
      case 'hybrid':
      default:
        return this.hybridPacking(products, cartons);
    }
  }

  hybridPacking(products, cartons) {
    const algorithms = ['ffd', 'bfd', 'guillotine'];
    let bestResult = null;
    let bestScore = -Infinity;
    let failureCount = 0;

    for (const algo of algorithms) {
      try {
        const result = this.packItems(products, cartons, algo);
        const score = this.evaluatePackingQuality(result);
        if (score > bestScore) {
          bestScore = score;
          bestResult = result;
        }
      } catch {
        failureCount += 1;
      }
    }

    return failureCount === algorithms.length ? this.basicPacking(products, cartons) : bestResult || this.basicPacking(products, cartons);
  }

  firstFitDecreasing(products, cartons) {
    const sortedProducts = [...products].sort((a, b) => {
      if (a.weightPerUnitKg !== b.weightPerUnitKg) return b.weightPerUnitKg - a.weightPerUnitKg;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.volume - a.volume;
    });

    const sortedCartons = [...cartons];
    const results = [];

    for (const product of sortedProducts) {
      let remainingQuantity = product.quantity;
      while (remainingQuantity > 0) {
        const bestFit = this.getAdaptiveBestFit(product, sortedCartons, remainingQuantity);
        if (!bestFit) break;
        results.push(bestFit);
        remainingQuantity -= bestFit.itemsPacked;
        bestFit.carton.availableQuantity--;
      }
    }
    return results;
  }

  bestFitDecreasing(products, cartons) {
    const sortedProducts = [...products].sort((a, b) => {
      if (a.weightPerUnitKg !== b.weightPerUnitKg) return b.weightPerUnitKg - a.weightPerUnitKg;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.volume - a.volume;
    });

    const results = [];
    for (const product of sortedProducts) {
      let remainingQuantity = product.quantity;
      while (remainingQuantity > 0) {
        const bestFit = this.getAdaptiveBestFit(product, cartons, remainingQuantity);
        if (!bestFit) break;
        results.push(bestFit);
        remainingQuantity -= bestFit.itemsPacked;
        bestFit.carton.availableQuantity--;
      }
    }
    return results;
  }

  getAdaptiveBestFit(product, cartons, remainingQuantity) {
    let bestFit = null;
    let bestScore = -Infinity;

    const compatibleCandidates = cartons.filter((carton) => {
      if ((Number(carton.availableQuantity) || 0) <= 0) return false;
      if (Number(product.weightPerUnitKg || 0) > Number(carton.maxWeight || 0)) return false;
      return canFitInAnyOrientation(product, { length: carton.length, breadth: carton.breadth, height: carton.height });
    });

    for (const carton of compatibleCandidates) {
      const packingResult = this.packProductInCarton(product, carton, remainingQuantity);
      if (!packingResult || packingResult.itemsPacked <= 0) continue;

      const score = this.calculateAdaptiveFitScore(packingResult);
      if (score > bestScore) {
        bestScore = score;
        bestFit = packingResult;
        continue;
      }

      if (Math.abs(score - bestScore) <= 1e-9 && bestFit) {
        const currentVolume = Number(carton.volume || 0);
        const selectedVolume = Number(bestFit.carton?.volume || 0);
        if (currentVolume > 0 && selectedVolume > 0 && currentVolume < selectedVolume) {
          bestFit = packingResult;
        }
      }
    }
    return bestFit;
  }

  calculateAdaptiveFitScore(packingResult) {
    const volumeEfficiency = clamp(Number(packingResult?.efficiency?.volumeEfficiency || 0), 0, 100) / 100;
    const spaceUtilization = clamp(Number(packingResult?.efficiency?.spaceUtilization || 0), 0, 1);
    const stability = clamp(this.calculateStabilityScore(packingResult.layout, packingResult.carton), 0, 1);
    return volumeEfficiency * 0.75 + spaceUtilization * 0.15 + stability * 0.1;
  }

  packWithGuillotine(products, cartons) {
    const results = [];
    const sortedProducts = [...products].sort((a, b) => b.volume - a.volume);

    for (const product of sortedProducts) {
      let remainingQuantity = product.quantity;
      while (remainingQuantity > 0) {
        let bestFit = null;
        let bestWasteRatio = Infinity;

        for (const carton of cartons) {
          if (carton.availableQuantity <= 0) continue;
          const packingResult = this.packWithGuillotineConstraints(product, carton, remainingQuantity);
          if (packingResult && packingResult.wasteRatio < bestWasteRatio) {
            bestWasteRatio = packingResult.wasteRatio;
            bestFit = packingResult;
          }
        }

        if (!bestFit) break;
        results.push(bestFit);
        remainingQuantity -= bestFit.itemsPacked;
        bestFit.carton.availableQuantity--;
      }
    }
    return results;
  }

  packWithSkyline(products, cartons) {
    return this.enhancedBasicPacking(products, cartons, 'skyline');
  }

  packProductInCarton(product, carton, maxQuantity) {
    if (!product.canRotate && !this.canFitOrientation(product, carton, 0)) return null;

    const orientations = this.getAllOrientations(product);
    let bestLayout = null;
    let bestScore = -Infinity;

    for (let orientationIndex = 0; orientationIndex < orientations.length; orientationIndex++) {
      const orientation = orientations[orientationIndex];
      const layout = this.calculateOptimal3DLayout(product, carton, orientation, maxQuantity);

      if (layout && layout.itemsPacked > 0) {
        const score = this.calculateLayoutScore(layout, product, carton);
        if (score > bestScore) {
          bestScore = score;
          bestLayout = layout;
          bestLayout.orientationIndex = orientationIndex;
          bestLayout.orientation = orientation;
        }
      }
    }

    if (!bestLayout) return null;

    return {
      product,
      carton,
      itemsPacked: bestLayout.itemsPacked,
      layout: bestLayout,
      orientationIndex: bestLayout.orientationIndex,
      orientation: bestLayout.orientation,
      efficiency: this.calculateEfficiency(bestLayout, carton),
      wasteRatio: this.calculateWasteRatio(bestLayout, carton),
      cost: this.calculatePackingCost(bestLayout, product, carton),
      costBreakdown: this.calculateCostBreakdown(bestLayout, product, carton),
      stackingInfo: bestLayout.stackingInfo,
      packedItems: bestLayout.packedItems,
    };
  }

  calculateOptimal3DLayout(product, carton, orientation, maxQuantity) {
    const [pLength, pBreadth, pHeight] = orientation.dims;

    if (pLength > carton.length || pBreadth > carton.breadth || pHeight > carton.height) return null;

    const itemsPerLength = Math.floor(carton.length / pLength);
    const itemsPerBreadth = Math.floor(carton.breadth / pBreadth);
    const itemsPerLayer = itemsPerLength * itemsPerBreadth;

    if (itemsPerLayer === 0) return null;

    const maxStackLayers = this.calculateMaxStackLayers(product, carton, pHeight);
    const totalItemsByVolume = itemsPerLayer * maxStackLayers;
    const maxItemsByWeight = Math.floor(carton.maxWeight / Math.max(product.weightPerUnitKg, 1e-9));
    const idealItemsPacked = Math.min(totalItemsByVolume, maxItemsByWeight, maxQuantity);

    if (idealItemsPacked === 0) return null;

    let actualItemsPacked = idealItemsPacked;
    let packedItems = [];
    let constraintMessages = [];

    while (actualItemsPacked > 0) {
      const generatedLayout = this.generate3DLayout(product, carton, orientation, itemsPerLength, itemsPerBreadth, actualItemsPacked, pLength, pBreadth, pHeight);
      packedItems = generatedLayout.packedItems;
      constraintMessages = generatedLayout.constraintMessages;

      if (this.validatePackedLayout(packedItems, carton)) break;
      actualItemsPacked--;
    }

    if (actualItemsPacked === 0 || packedItems.length === 0) return null;

    const stackingInfo = this.analyzeStacking(packedItems, product, carton);

    return {
      itemsPacked: actualItemsPacked,
      itemsPerLayer,
      layers: Math.ceil(actualItemsPacked / itemsPerLayer),
      arrangement: { lengthwise: itemsPerLength, breadthwise: itemsPerBreadth, layers: Math.ceil(actualItemsPacked / itemsPerLayer) },
      packedItems,
      constraintMessages,
      stackingInfo,
      spaceUtilization: this.calculateSpaceUtilization(packedItems, carton),
      centerOfMass: this.calculateCenterOfMass(packedItems, carton),
    };
  }

  validatePackedLayout(packedItems, carton) {
    if (!Array.isArray(packedItems) || packedItems.length === 0) return false;

    for (let index = 0; index < packedItems.length; index++) {
      const current = packedItems[index];
      const currentMaxX = current.position.x + current.dimensions.length;
      const currentMaxY = current.position.y + current.dimensions.breadth;
      const currentMaxZ = current.position.z + current.dimensions.height;

      if (current.position.x < 0 || current.position.y < 0 || current.position.z < 0 ||
          currentMaxX > carton.length + 1e-9 || currentMaxY > carton.breadth + 1e-9 || currentMaxZ > carton.height + 1e-9) {
        return false;
      }

      for (let otherIndex = index + 1; otherIndex < packedItems.length; otherIndex++) {
        if (packedItemsOverlap(current, packedItems[otherIndex])) return false;
      }
    }
    return true;
  }

  generate3DLayout(product, carton, orientation, itemsPerLength, itemsPerBreadth, totalItems, pLength, pBreadth, pHeight) {
    const packedItems = [];
    const constraintMessages = new Set();
    let itemIndex = 0;
    const totalSlots = itemsPerLength * itemsPerBreadth;
    const stackState = Array.from({ length: totalSlots }, () => ({ size: 0, cumulativeWeightKg: 0, baseCrushResistanceKg: null, topLeakageRisk: null, lockedAbove: false }));
    const totalLayers = Math.ceil(totalItems / totalSlots);

    for (let layer = 0; layer < totalLayers && itemIndex < totalItems; layer++) {
      const z = layer * pHeight;
      let placedInLayer = 0;

      for (let breadthIndex = 0; breadthIndex < itemsPerBreadth && itemIndex < totalItems; breadthIndex++) {
        const y = breadthIndex * pBreadth;
        for (let lengthIndex = 0; lengthIndex < itemsPerLength && itemIndex < totalItems; lengthIndex++) {
          const slotIndex = breadthIndex * itemsPerLength + lengthIndex;
          const stack = stackState[slotIndex];

          if (stack.size >= product.maxVerticalStack) {
            constraintMessages.add(`Maximum stack height reached`);
            continue;
          }
          if (stack.lockedAbove) {
            constraintMessages.add('No-Stack Zone active');
            continue;
          }

          const baseCrushResistanceKg = stack.baseCrushResistanceKg ?? product.crushResistanceKg;
          const projectedWeightKg = stack.cumulativeWeightKg + product.weightPerUnitKg;
          if (projectedWeightKg > baseCrushResistanceKg) {
            constraintMessages.add('Stack weight limit reached');
            continue;
          }

          const x = lengthIndex * pLength;
          const position = new Position3D(x, y, z);
          const packedItem = new PackedItem(product, position, orientation.index, layer + 1);
          packedItems.push(packedItem);
          itemIndex++;
          placedInLayer++;

          stack.size += 1;
          stack.cumulativeWeightKg = projectedWeightKg;
          if (stack.baseCrushResistanceKg === null) stack.baseCrushResistanceKg = product.crushResistanceKg;
          stack.topLeakageRisk = product.leakageRisk;
          if (product.noStackAbove) stack.lockedAbove = true;
        }
      }
      if (placedInLayer === 0) break;
    }

    return { packedItems, constraintMessages: Array.from(constraintMessages) };
  }

  calculateMaxStackLayers(product, carton, itemHeight) {
    const maxLayersByHeight = Math.floor(carton.height / itemHeight);
    const maxLayersByCrush = product.weightPerUnitKg > 0 ? Math.floor(product.crushResistanceKg / product.weightPerUnitKg) : maxLayersByHeight;
    const maxLayersByFragility = product.isFragile ? Math.min(3, maxLayersByHeight) : maxLayersByHeight;
    const maxLayersByVerticalLimit = Math.max(1, product.maxVerticalStack || 1);
    return Math.min(maxLayersByHeight, maxLayersByCrush, maxLayersByFragility, maxLayersByVerticalLimit, carton.maxStackLayers);
  }

  getAllOrientations(product) {
    const orientations = [
      { dims: [product.length, product.breadth, product.height], name: 'L×B×H', index: 0 },
      { dims: [product.length, product.height, product.breadth], name: 'L×H×B', index: 1 },
      { dims: [product.breadth, product.length, product.height], name: 'B×L×H', index: 2 },
      { dims: [product.breadth, product.height, product.length], name: 'B×H×L', index: 3 },
      { dims: [product.height, product.length, product.breadth], name: 'H×L×B', index: 4 },
      { dims: [product.height, product.breadth, product.length], name: 'H×B×L', index: 5 },
    ];

    if (!product.canRotate) return [orientations[0]];
    if (product.mustStayUpright) return orientations.filter((o) => o.dims[2] === product.height);
    return orientations;
  }

  calculatePackingCost(layout, product, carton) {
    const breakdown = this.calculateCostBreakdown(layout, product, carton);
    return breakdown.total;
  }

  calculateCostBreakdown(layout, product, carton) {
    const boxPrice = Number(carton.cost || 0);
    const handlingFeePerBox = getHandlingFeePerBox(carton);
    const fragileSurcharge = 0;

    return {
      boxPrice: toFixedNumber(boxPrice),
      handlingFeePerBox: toFixedNumber(handlingFeePerBox),
      fragileSurcharge: toFixedNumber(fragileSurcharge),
      cartonCost: toFixedNumber(boxPrice),
      shippingRatePerKg: 0,
      shippingCostByWeight: 0,
      handlingFee: toFixedNumber(handlingFeePerBox),
      total: toFixedNumber(boxPrice + handlingFeePerBox + fragileSurcharge),
    };
  }

  calculateEfficiency(layout, carton) {
    const totalItemVolume = layout.packedItems.reduce((sum, item) => sum + item.volume, 0);
    const totalItemWeight = layout.packedItems.reduce((sum, item) => sum + item.weight, 0);
    return {
      volumeEfficiency: Math.min(100, carton.volume > 0 ? (totalItemVolume / carton.volume) * 100 : 0),
      spaceUtilization: layout.spaceUtilization,
      weightUtilization: Math.min(100, carton.maxWeight > 0 ? (totalItemWeight / carton.maxWeight) * 100 : 0),
    };
  }

  calculateSpaceUtilization(packedItems, carton) {
    const totalItemVolume = packedItems.reduce((sum, item) => sum + item.volume, 0);
    return carton.volume > 0 ? totalItemVolume / carton.volume : 0;
  }

  calculateCenterOfMass(packedItems, carton) {
    if (packedItems.length === 0) return new Position3D();
    const totalWeight = packedItems.reduce((sum, item) => sum + item.weight, 0);
    let weightedX = 0, weightedY = 0, weightedZ = 0;

    for (const item of packedItems) {
      const centerX = item.position.x + item.dimensions.length / 2;
      const centerY = item.position.y + item.dimensions.breadth / 2;
      const centerZ = item.position.z + item.dimensions.height / 2;
      weightedX += centerX * item.weight;
      weightedY += centerY * item.weight;
      weightedZ += centerZ * item.weight;
    }

    if (totalWeight <= 0) return new Position3D(carton.length / 2, carton.breadth / 2, carton.height / 2);
    return new Position3D(weightedX / totalWeight, weightedY / totalWeight, weightedZ / totalWeight);
  }

  calculateWasteRatio(layout, carton) {
    return 1 - layout.spaceUtilization;
  }

  calculateLayoutScore(layout, product, carton) {
    const spaceScore = layout.spaceUtilization;
    const stackingScore = this.calculateStackingScore(layout, product);
    const stabilityScore = this.calculateStabilityScore(layout, carton);
    return spaceScore * 0.5 + stackingScore * 0.3 + stabilityScore * 0.2;
  }

  calculateStackingScore(layout, product) {
    if (layout.layers <= 1) return 0.5;
    if (product.isFragile && layout.layers > 3) return 0.3;
    return Math.min(1, layout.layers / 5);
  }

  calculateStabilityScore(layout, carton) {
    if (!layout?.centerOfMass || !carton) return 0.5;
    const com = layout.centerOfMass;
    const centerX = carton.length / 2;
    const centerY = carton.breadth / 2;
    const centerZ = carton.height / 2;
    const distanceFromCenter = Math.hypot(com.x - centerX, com.y - centerY, com.z - centerZ);
    const maxDistance = Math.hypot(centerX, centerY, centerZ);
    return 1 - distanceFromCenter / maxDistance;
  }

  analyzeStacking(packedItems, product, carton) {
    const layers = Math.max(...packedItems.map((item) => item.stackLevel));
    const itemsPerLayer = packedItems.filter((item) => item.stackLevel === 1).length;
    const averageWeightPerLayer = itemsPerLayer * product.weightPerUnitKg;
    const maxSafeWeight = product.crushResistanceKg;

    return {
      totalLayers: layers,
      itemsPerLayer,
      averageWeightPerLayer,
      stackingSafety: averageWeightPerLayer <= maxSafeWeight,
      stackingEfficiency: layers > 1 ? 1 : 0.5,
      isFragileStacking: product.isFragile && layers > 1,
    };
  }

  canFitOrientation(product, carton, orientationIndex) {
    const orientations = this.getAllOrientations(product);
    const [pLength, pBreadth, pHeight] = orientations[orientationIndex].dims;
    return pLength <= carton.length && pBreadth <= carton.breadth && pHeight <= carton.height;
  }

  evaluatePackingQuality(results) {
    if (!results || results.length === 0) return -Infinity;
    const totalItems = results.reduce((sum, r) => sum + r.itemsPacked, 0);
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const avgEfficiency = results.reduce((sum, r) => sum + r.efficiency.volumeEfficiency, 0) / results.length;
    return totalItems * 100 - totalCost - (1 - avgEfficiency) * 50;
  }

  basicPacking(products, cartons) {
    return this.firstFitDecreasing(products, cartons);
  }

  enhancedBasicPacking(products, cartons, method) {
    return this.firstFitDecreasing(products, cartons);
  }

  packWithGuillotineConstraints(product, carton, maxQuantity) {
    return this.packProductInCarton(product, carton, maxQuantity);
  }
}

export default Advanced3DBinPacker;
