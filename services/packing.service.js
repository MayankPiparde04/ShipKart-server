// Enhanced Product class with fragility and stacking rules
class Product {
  constructor(length, breadth, height, weight, quantity, options = {}) {
    const normalizedLength = Number(length);
    const normalizedBreadth = Number(breadth);
    const normalizedHeight = Number(height);
    const normalizedWeight = Number(weight);
    const normalizedQuantity = Number(quantity);

    if (
      !Number.isFinite(normalizedLength) ||
      !Number.isFinite(normalizedBreadth) ||
      !Number.isFinite(normalizedHeight) ||
      !Number.isFinite(normalizedWeight) ||
      !Number.isFinite(normalizedQuantity) ||
      normalizedLength <= 0 ||
      normalizedBreadth <= 0 ||
      normalizedHeight <= 0 ||
      normalizedWeight <= 0 ||
      normalizedQuantity <= 0
    ) {
      throw new Error(
        "All product dimensions, weight, and quantity must be positive numbers",
      );
    }
    this.id = options.id || `product_${Date.now()}`;
    this.name = options.name || "Unknown Product";
    this.length = normalizedLength;
    this.breadth = normalizedBreadth;
    this.height = normalizedHeight;
    this.weight = normalizedWeight;
    this.quantity = Math.floor(normalizedQuantity);
    this.volume = normalizedLength * normalizedBreadth * normalizedHeight;
    this.density = weight / this.volume;

    // Structural integrity properties (required for safe stacking constraints)
    this.weightPerUnitKg =
      Number(options.weightPerUnitKg) > 0
        ? Number(options.weightPerUnitKg)
        : weight / 1000;
    this.maxVerticalStack =
      Number.parseInt(options.maxVerticalStack, 10) > 0
        ? Number.parseInt(options.maxVerticalStack, 10)
        : 1;
    this.crushResistanceKg =
      Number(options.crushResistanceKg) > 0
        ? Number(options.crushResistanceKg)
        : this.weightPerUnitKg * 50;
    this.leakageRisk = ["High", "Medium", "Low"].includes(options.leakageRisk)
      ? options.leakageRisk
      : "Low";

    // Fragility and stacking rules
    this.isFragile = options.isFragile || false;
    this.maxStackHeight =
      options.maxStackHeight || this.maxVerticalStack || Math.floor(height * 10); // Backward-compatible alias
    this.maxStackWeight = options.maxStackWeight || weight * 50; // Default: 50x product weight
    this.canRotate = options.canRotate !== false; // Default: true
    this.mustStayUpright = options.mustStayUpright === true || options.upright === true;
    this.noStackAbove = options.noStackAbove === true || this.leakageRisk === "High";
    this.priority = options.priority || 1; // Higher = more important to pack

    // Cost factors
    this.value = options.value || 0;
    this.damageCost = options.damageCost || this.value * 0.1;
  }
}

// Enhanced Carton class with cost and priority factors
class Carton {
  constructor(length, breadth, height, maxWeight, options = {}) {
    const normalizedLength = Number(length);
    const normalizedBreadth = Number(breadth);
    const normalizedHeight = Number(height);
    const normalizedMaxWeight = Number(maxWeight);

    if (
      !Number.isFinite(normalizedLength) ||
      !Number.isFinite(normalizedBreadth) ||
      !Number.isFinite(normalizedHeight) ||
      !Number.isFinite(normalizedMaxWeight) ||
      normalizedLength <= 0 ||
      normalizedBreadth <= 0 ||
      normalizedHeight <= 0 ||
      normalizedMaxWeight <= 0
    ) {
      throw new Error(
        "All carton dimensions and max weight must be positive numbers",
      );
    }
    this.id = options.id || `carton_${Date.now()}`;
    this.name = options.name || "Standard Carton";
    this.length = normalizedLength;
    this.breadth = normalizedBreadth;
    this.height = normalizedHeight;
    this.maxWeight = normalizedMaxWeight;
    this.volume = normalizedLength * normalizedBreadth * normalizedHeight;
    this.availableQuantity = options.availableQuantity || 1;

    // Cost factors
    this.cost = options.cost || this.volume * 0.001; // Default cost per cubic unit
    this.shippingCost =
      options.shippingCost || this.volume * 0.0005 + this.maxWeight * 0.01;
    this.priority = options.priority || 1; // Higher = preferred choice
    this.popularity = options.popularity || 0; // Usage frequency score

    // Physical properties
    this.fragileSupport = options.fragileSupport !== false; // Can hold fragile items
    this.maxStackLayers = options.maxStackLayers || 10;
  }
}

// 3D Position and Layout classes for visualization
class Position3D {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class PackedItem {
  constructor(product, position, orientation, stackLevel = 1) {
    this.productId = product.id;
    this.productName = product.name;
    this.position = position;
    this.orientation = orientation;
    this.stackLevel = stackLevel;
    this.dimensions = this.getOrientedDimensions(product, orientation);
    this.weight = product.weightPerUnitKg;
    this.volume = product.volume;
  }

  getOrientedDimensions(product, orientation) {
    const orientations = [
      [product.length, product.breadth, product.height], // L×B×H
      [product.length, product.height, product.breadth], // L×H×B
      [product.breadth, product.length, product.height], // B×L×H
      [product.breadth, product.height, product.length], // B×H×L
      [product.height, product.length, product.breadth], // H×L×B
      [product.height, product.breadth, product.length], // H×B×L
    ];
    const [l, b, h] = orientations[orientation];
    return { length: l, breadth: b, height: h };
  }
}

function isAxisAlignedOverlap(aMin, aMax, bMin, bMax) {
  return aMin < bMax && aMax > bMin;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toFixedNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(2));
}

function packedItemsOverlap(firstItem, secondItem) {
  const firstMaxX = firstItem.position.x + firstItem.dimensions.length;
  const firstMaxY = firstItem.position.y + firstItem.dimensions.breadth;
  const firstMaxZ = firstItem.position.z + firstItem.dimensions.height;

  const secondMaxX = secondItem.position.x + secondItem.dimensions.length;
  const secondMaxY = secondItem.position.y + secondItem.dimensions.breadth;
  const secondMaxZ = secondItem.position.z + secondItem.dimensions.height;

  return (
    isAxisAlignedOverlap(
      firstItem.position.x,
      firstMaxX,
      secondItem.position.x,
      secondMaxX,
    ) &&
    isAxisAlignedOverlap(
      firstItem.position.y,
      firstMaxY,
      secondItem.position.y,
      secondMaxY,
    ) &&
    isAxisAlignedOverlap(
      firstItem.position.z,
      firstMaxZ,
      secondItem.position.z,
      secondMaxZ,
    )
  );
}

// Advanced 3D Bin Packing Algorithm
class Advanced3DBinPacker {
  constructor() {
    this.algorithms = {
      FIRST_FIT_DECREASING: "ffd",
      BEST_FIT_DECREASING: "bfd",
      GUILLOTINE: "guillotine",
      SKYLINE: "skyline",
      HYBRID: "hybrid",
    };
  }

  // Main packing method with algorithm selection
  packItems(products, cartons, algorithm = "hybrid") {
    switch (algorithm) {
      case "ffd":
        return this.firstFitDecreasing(products, cartons);
      case "bfd":
        return this.bestFitDecreasing(products, cartons);
      case "guillotine":
        return this.packWithGuillotine(products, cartons);
      case "skyline":
        return this.packWithSkyline(products, cartons);
      case "hybrid":
      default:
        return this.hybridPacking(products, cartons);
    }
  }

  // Hybrid approach combining multiple algorithms
  hybridPacking(products, cartons) {
    // Try different algorithms and pick the best result
    const algorithms = ["ffd", "bfd", "guillotine"];
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

    if (failureCount === algorithms.length) {
      return this.basicPacking(products, cartons);
    }

    return bestResult || this.basicPacking(products, cartons);
  }

  // Enhanced First Fit Decreasing with 3D considerations
  firstFitDecreasing(products, cartons) {
    // Pass A: Gravity heuristic sort (heaviest units first)
    const sortedProducts = [...products].sort((a, b) => {
      if (a.weightPerUnitKg !== b.weightPerUnitKg) {
        return b.weightPerUnitKg - a.weightPerUnitKg;
      }
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.volume - a.volume;
    });

    // Sort cartons by efficiency score
    const sortedCartons = this.sortCartonsByPriority(cartons);
    const results = [];

    for (const product of sortedProducts) {
      let remainingQuantity = product.quantity;

      while (remainingQuantity > 0) {
        let bestFit = null;

        for (const carton of sortedCartons) {
          if (carton.availableQuantity <= 0) continue;

          const packingResult = this.packProductInCarton(
            product,
            carton,
            remainingQuantity,
          );
          if (packingResult && packingResult.itemsPacked > 0) {
            bestFit = packingResult;
            break; // First fit
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

  // Enhanced Best Fit Decreasing
  bestFitDecreasing(products, cartons) {
    const sortedProducts = [...products].sort((a, b) => {
      if (a.weightPerUnitKg !== b.weightPerUnitKg) {
        return b.weightPerUnitKg - a.weightPerUnitKg;
      }
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.volume - a.volume;
    });

    const results = [];

    for (const product of sortedProducts) {
      let remainingQuantity = product.quantity;

      while (remainingQuantity > 0) {
        let bestFit = null;
        let bestScore = -Infinity;

        for (const carton of cartons) {
          if (carton.availableQuantity <= 0) continue;

          const packingResult = this.packProductInCarton(
            product,
            carton,
            remainingQuantity,
          );
          if (packingResult && packingResult.itemsPacked > 0) {
            const score = this.calculatePackingScore(packingResult);
            if (score > bestScore) {
              bestScore = score;
              bestFit = packingResult;
            }
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

  // Guillotine-based packing for better space utilization
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

          const packingResult = this.packWithGuillotineConstraints(
            product,
            carton,
            remainingQuantity,
          );
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

  // Skyline-based packing algorithm
  packWithSkyline(products, cartons) {
    // Implementation would be similar to guillotine but with skyline data structure
    // For brevity, using enhanced basic packing with skyline principles
    return this.enhancedBasicPacking(products, cartons, "skyline");
  }

  // Core product-in-carton packing logic with 3D layout
  packProductInCarton(product, carton, maxQuantity) {
    if (!product.canRotate && !this.canFitOrientation(product, carton, 0)) {
      return null;
    }

    const orientations = this.getAllOrientations(product);
    let bestLayout = null;
    let bestScore = -Infinity;

    for (
      let orientationIndex = 0;
      orientationIndex < orientations.length;
      orientationIndex++
    ) {
      const orientation = orientations[orientationIndex];
      const layout = this.calculateOptimal3DLayout(
        product,
        carton,
        orientation,
        maxQuantity,
      );

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
      product: product,
      carton: carton,
      itemsPacked: bestLayout.itemsPacked,
      layout: bestLayout,
      orientationIndex: bestLayout.orientationIndex,
      orientation: bestLayout.orientation,
      efficiency: this.calculateEfficiency(bestLayout, carton),
      wasteRatio: this.calculateWasteRatio(bestLayout, carton),
      cost: this.calculatePackingCost(bestLayout, product, carton),
      stackingInfo: bestLayout.stackingInfo,
      packedItems: bestLayout.packedItems,
    };
  }

  // Calculate optimal 3D layout with stacking logic
  calculateOptimal3DLayout(product, carton, orientation, maxQuantity) {
    const [pLength, pBreadth, pHeight] = orientation.dims;

    // Check basic fit
    if (
      pLength > carton.length ||
      pBreadth > carton.breadth ||
      pHeight > carton.height
    ) {
      return null;
    }

    // Calculate base layer arrangement
    const itemsPerLength = Math.floor(carton.length / pLength);
    const itemsPerBreadth = Math.floor(carton.breadth / pBreadth);
    const itemsPerLayer = itemsPerLength * itemsPerBreadth;

    if (itemsPerLayer === 0) return null;

    // Calculate stacking possibilities
    const maxStackLayers = this.calculateMaxStackLayers(
      product,
      carton,
      pHeight,
    );
    const totalItemsByVolume = itemsPerLayer * maxStackLayers;

    // Weight constraint
    const maxItemsByWeight = Math.floor(
      carton.maxWeight / Math.max(product.weightPerUnitKg, 1e-9),
    );

    // Final quantity considering all constraints
    const idealItemsPacked = Math.min(
      totalItemsByVolume,
      maxItemsByWeight,
      maxQuantity,
    );

    if (idealItemsPacked === 0) return null;

    let actualItemsPacked = idealItemsPacked;
    let packedItems = [];
    let constraintMessages = [];

    while (actualItemsPacked > 0) {
      const generatedLayout = this.generate3DLayout(
        product,
        carton,
        orientation,
        itemsPerLength,
        itemsPerBreadth,
        actualItemsPacked,
        pLength,
        pBreadth,
        pHeight,
      );

      packedItems = generatedLayout.packedItems;
      constraintMessages = generatedLayout.constraintMessages;

      if (this.validatePackedLayout(packedItems, carton)) {
        break;
      }

      actualItemsPacked--;
    }

    if (actualItemsPacked === 0 || packedItems.length === 0) return null;

    // Calculate stacking information
    const stackingInfo = this.analyzeStacking(packedItems, product, carton);

    return {
      itemsPacked: actualItemsPacked,
      itemsPerLayer,
      layers: Math.ceil(actualItemsPacked / itemsPerLayer),
      arrangement: {
        lengthwise: itemsPerLength,
        breadthwise: itemsPerBreadth,
        layers: Math.ceil(actualItemsPacked / itemsPerLayer),
      },
      packedItems,
      constraintMessages,
      stackingInfo,
      spaceUtilization: this.calculateSpaceUtilization(packedItems, carton),
      centerOfMass: this.calculateCenterOfMass(packedItems, carton),
    };
  }

  validatePackedLayout(packedItems, carton) {
    if (!Array.isArray(packedItems) || packedItems.length === 0) {
      return false;
    }

    for (let index = 0; index < packedItems.length; index++) {
      const current = packedItems[index];
      const currentMaxX = current.position.x + current.dimensions.length;
      const currentMaxY = current.position.y + current.dimensions.breadth;
      const currentMaxZ = current.position.z + current.dimensions.height;

      if (
        current.position.x < 0 ||
        current.position.y < 0 ||
        current.position.z < 0 ||
        currentMaxX > carton.length + 1e-9 ||
        currentMaxY > carton.breadth + 1e-9 ||
        currentMaxZ > carton.height + 1e-9
      ) {
        return false;
      }

      for (let otherIndex = index + 1; otherIndex < packedItems.length; otherIndex++) {
        if (packedItemsOverlap(current, packedItems[otherIndex])) {
          return false;
        }
      }
    }

    return true;
  }

  // Generate detailed 3D layout with positions
  generate3DLayout(
    product,
    carton,
    orientation,
    itemsPerLength,
    itemsPerBreadth,
    totalItems,
    pLength,
    pBreadth,
    pHeight,
  ) {
    const packedItems = [];
    const constraintMessages = new Set();
    let itemIndex = 0;
    const totalSlots = itemsPerLength * itemsPerBreadth;

    // Maintain per X-Y column stack state
    const stackState = Array.from({ length: totalSlots }, () => ({
      size: 0,
      cumulativeWeightKg: 0,
      baseCrushResistanceKg: null,
      topLeakageRisk: null,
      lockedAbove: false,
    }));

    const totalLayers = Math.ceil(totalItems / totalSlots);

    for (let layer = 0; layer < totalLayers && itemIndex < totalItems; layer++) {
      const z = layer * pHeight;

      let placedInLayer = 0;

      for (
        let breadthIndex = 0;
        breadthIndex < itemsPerBreadth && itemIndex < totalItems;
        breadthIndex++
      ) {
        const y = breadthIndex * pBreadth;

        for (
          let lengthIndex = 0;
          lengthIndex < itemsPerLength && itemIndex < totalItems;
          lengthIndex++
        ) {
          const slotIndex = breadthIndex * itemsPerLength + lengthIndex;
          const stack = stackState[slotIndex];

          // 1) Vertical stack count check
          if (stack.size >= product.maxVerticalStack) {
            constraintMessages.add(
              `Vertical limit reached: Max ${product.maxVerticalStack} units per stack.`,
            );
            continue;
          }

          // 3) Leakage no-stack zone check
          if (stack.lockedAbove) {
            constraintMessages.add("No-Stack Zone: High Leakage Risk detected.");
            continue;
          }

          // 2) Cumulative crush-resistance check
          const baseCrushResistanceKg =
            stack.baseCrushResistanceKg ?? product.crushResistanceKg;
          const projectedWeightKg =
            stack.cumulativeWeightKg + product.weightPerUnitKg;
          if (projectedWeightKg > baseCrushResistanceKg) {
            constraintMessages.add("Stacking limited by Base Load Capacity.");
            continue;
          }

          const x = lengthIndex * pLength;

          const position = new Position3D(x, y, z);
          const packedItem = new PackedItem(
            product,
            position,
            orientation.index,
            layer + 1,
          );

          packedItems.push(packedItem);
          itemIndex++;
          placedInLayer++;

          // Update stack state for the placed item
          stack.size += 1;
          stack.cumulativeWeightKg = projectedWeightKg;
          if (stack.baseCrushResistanceKg === null) {
            stack.baseCrushResistanceKg = product.crushResistanceKg;
          }
          stack.topLeakageRisk = product.leakageRisk;
          if (product.noStackAbove) {
            stack.lockedAbove = true;
          }
        }
      }

      // No placeable slot remains under constraints
      if (placedInLayer === 0) {
        break;
      }
    }

    return {
      packedItems,
      constraintMessages: Array.from(constraintMessages),
    };
  }

  // Calculate maximum stack layers considering fragility and weight
  calculateMaxStackLayers(product, carton, itemHeight) {
    const maxLayersByHeight = Math.floor(carton.height / itemHeight);
    const maxLayersByCrush =
      product.weightPerUnitKg > 0
        ? Math.floor(product.crushResistanceKg / product.weightPerUnitKg)
        : maxLayersByHeight;
    const maxLayersByFragility = product.isFragile
      ? Math.min(3, maxLayersByHeight)
      : maxLayersByHeight;
    const maxLayersByVerticalLimit = Math.max(1, product.maxVerticalStack || 1);

    return Math.min(
      maxLayersByHeight,
      maxLayersByCrush,
      maxLayersByFragility,
      maxLayersByVerticalLimit,
      carton.maxStackLayers,
    );
  }

  // Get all possible orientations
  getAllOrientations(product) {
    const orientations = [
      {
        dims: [product.length, product.breadth, product.height],
        name: "L×B×H",
        index: 0,
      },
      {
        dims: [product.length, product.height, product.breadth],
        name: "L×H×B",
        index: 1,
      },
      {
        dims: [product.breadth, product.length, product.height],
        name: "B×L×H",
        index: 2,
      },
      {
        dims: [product.breadth, product.height, product.length],
        name: "B×H×L",
        index: 3,
      },
      {
        dims: [product.height, product.length, product.breadth],
        name: "H×L×B",
        index: 4,
      },
      {
        dims: [product.height, product.breadth, product.length],
        name: "H×B×L",
        index: 5,
      },
    ];

    if (!product.canRotate) {
      return [orientations[0]];
    }

    if (product.mustStayUpright) {
      return orientations.filter((orientation) => orientation.dims[2] === product.height);
    }

    return orientations;
  }

  // Sort cartons by priority considering multiple factors
  sortCartonsByPriority(cartons) {
    return [...cartons].sort((a, b) => {
      // Multi-criteria sorting
      const scoreA = this.calculateCartonScore(a);
      const scoreB = this.calculateCartonScore(b);
      return scoreB - scoreA;
    });
  }

  // Calculate carton selection score
  calculateCartonScore(carton) {
    const costFactor = 1 / (carton.cost + 1); // Lower cost = higher score
    const priorityFactor = carton.priority;
    const popularityFactor = carton.popularity + 1;
    const availabilityFactor = carton.availableQuantity > 0 ? 1 : 0;

    return (
      costFactor * 0.3 +
      priorityFactor * 0.4 +
      popularityFactor * 0.2 +
      availabilityFactor * 0.1
    );
  }

  // Calculate packing cost
  calculatePackingCost(layout, product, carton) {
    const baseCost = carton.cost;
    const shippingCost = carton.shippingCost;
    const inefficiencyPenalty =
      (1 - layout.spaceUtilization) * carton.cost * 0.5;
    const fragilityPenalty =
      product.isFragile && layout.layers > 2 ? product.damageCost * 0.1 : 0;

    return baseCost + shippingCost + inefficiencyPenalty + fragilityPenalty;
  }

  // Calculate various efficiency and quality metrics
  calculateEfficiency(layout, carton) {
    const totalItemVolume = layout.packedItems.reduce(
      (sum, item) => sum + item.volume,
      0,
    );
    const totalItemWeight = layout.packedItems.reduce(
      (sum, item) => sum + item.weight,
      0,
    );

    return {
      volumeEfficiency: Math.min(
        100,
        carton.volume > 0 ? (totalItemVolume / carton.volume) * 100 : 0,
      ),
      spaceUtilization: layout.spaceUtilization,
      weightUtilization: Math.min(
        100,
        carton.maxWeight > 0 ? (totalItemWeight / carton.maxWeight) * 100 : 0,
      ),
    };
  }

  calculateSpaceUtilization(packedItems, carton) {
    const totalItemVolume = packedItems.reduce(
      (sum, item) => sum + item.volume,
      0,
    );
    return carton.volume > 0 ? totalItemVolume / carton.volume : 0;
  }

  calculateCenterOfMass(packedItems, carton) {
    if (packedItems.length === 0) return new Position3D();

    const totalWeight = packedItems.reduce((sum, item) => sum + item.weight, 0);
    let weightedX = 0,
      weightedY = 0,
      weightedZ = 0;

    for (const item of packedItems) {
      const centerX = item.position.x + item.dimensions.length / 2;
      const centerY = item.position.y + item.dimensions.breadth / 2;
      const centerZ = item.position.z + item.dimensions.height / 2;

      weightedX += centerX * item.weight;
      weightedY += centerY * item.weight;
      weightedZ += centerZ * item.weight;
    }

    if (totalWeight <= 0) {
      return new Position3D(carton.length / 2, carton.breadth / 2, carton.height / 2);
    }

    return new Position3D(
      weightedX / totalWeight,
      weightedY / totalWeight,
      weightedZ / totalWeight,
    );
  }

  // Additional helper methods
  calculateWasteRatio(layout, carton) {
    return 1 - layout.spaceUtilization;
  }

  calculatePackingScore(packingResult) {
    const efficiency = packingResult.efficiency.volumeEfficiency / 100;
    const utilization = packingResult.efficiency.spaceUtilization;
    const costFactor = 1 / (packingResult.cost + 1);

    return efficiency * 0.4 + utilization * 0.4 + costFactor * 0.2;
  }

  calculateLayoutScore(layout, product, carton) {
    const spaceScore = layout.spaceUtilization;
    const stackingScore = this.calculateStackingScore(layout, product);
    const stabilityScore = this.calculateStabilityScore(layout, carton);

    return spaceScore * 0.5 + stackingScore * 0.3 + stabilityScore * 0.2;
  }

  calculateStackingScore(layout, product) {
    if (layout.layers <= 1) return 0.5; // Penalize single layer
    if (product.isFragile && layout.layers > 3) return 0.3; // Penalize over-stacking fragile items
    return Math.min(1, layout.layers / 5); // Reward efficient stacking
  }

  calculateStabilityScore(layout, carton) {
    // Add null checks
    if (!layout?.centerOfMass || !carton) {
      return 0.5; // Default stability score
    }

    // Simple stability based on center of mass
    const com = layout.centerOfMass;

    const centerX = carton.length / 2;
    const centerY = carton.breadth / 2;
    const centerZ = carton.height / 2;

    const distanceFromCenter = Math.hypot(
      com.x - centerX,
      com.y - centerY,
      com.z - centerZ,
    );

    const maxDistance = Math.hypot(centerX, centerY, centerZ);
    return 1 - distanceFromCenter / maxDistance;
  }

  analyzeStacking(packedItems, product, carton) {
    const layers = Math.max(...packedItems.map((item) => item.stackLevel));
    const itemsPerLayer = packedItems.filter(
      (item) => item.stackLevel === 1,
    ).length;
    const averageWeightPerLayer = itemsPerLayer * product.weightPerUnitKg;
    const maxSafeWeight = product.crushResistanceKg;

    return {
      totalLayers: layers,
      itemsPerLayer: itemsPerLayer,
      averageWeightPerLayer: averageWeightPerLayer,
      stackingSafety: averageWeightPerLayer <= maxSafeWeight,
      stackingEfficiency: layers > 1 ? 1 : 0.5,
      isFragileStacking: product.isFragile && layers > 1,
    };
  }

  canFitOrientation(product, carton, orientationIndex) {
    const orientations = this.getAllOrientations(product);
    const [pLength, pBreadth, pHeight] = orientations[orientationIndex].dims;
    return (
      pLength <= carton.length &&
      pBreadth <= carton.breadth &&
      pHeight <= carton.height
    );
  }

  evaluatePackingQuality(results) {
    if (!results || results.length === 0) return -Infinity;

    const totalItems = results.reduce(
      (sum, result) => sum + result.itemsPacked,
      0,
    );
    const totalCost = results.reduce((sum, result) => sum + result.cost, 0);
    const avgEfficiency =
      results.reduce(
        (sum, result) => sum + result.efficiency.volumeEfficiency,
        0,
      ) / results.length;

    return totalItems * 100 - totalCost - (1 - avgEfficiency) * 50;
  }

  // Fallback basic packing
  basicPacking(products, cartons) {
    // Simplified version for fallback
    return this.firstFitDecreasing(products, cartons);
  }

  enhancedBasicPacking(products, cartons, method) {
    // Enhanced basic packing with specific method considerations
    return this.firstFitDecreasing(products, cartons);
  }

  packWithGuillotineConstraints(product, carton, maxQuantity) {
    // Simplified guillotine constraints
    const result = this.packProductInCarton(product, carton, maxQuantity);
    if (result) {
      result.wasteRatio = this.calculateWasteRatio(result.layout, carton);
    }
    return result;
  }
}

// Helper functions for the service
function calculateOverallPackingScore(results) {
  if (!results || results.length === 0) return 0;

  const normalizedScore =
    results.reduce((sum, result) => {
      const volumeEfficiency = clamp(
        Number(result?.efficiency?.volumeEfficiency || 0) / 100,
        0,
        1,
      );
      const spaceUtilization = clamp(
        Number(result?.efficiency?.spaceUtilization || 0) / 100,
        0,
        1,
      );
      const weightUtilization = clamp(
        Number(result?.efficiency?.weightUtilization || 0) / 100,
        0,
        1,
      );
      const wasteRatio = clamp(
        Number(result?.packingMetrics?.wasteSpace || 0) /
          Math.max(Number(result?.cartonDetails?.volume || 0), 1),
        0,
        1,
      );
      const wasteControl = 1 - wasteRatio;

      return (
        sum +
        volumeEfficiency * 0.45 +
        spaceUtilization * 0.3 +
        weightUtilization * 0.15 +
        wasteControl * 0.1
      );
    }, 0) / results.length;

  return toFixedNumber(clamp(normalizedScore * 100, 0, 100));
}

function calculateWasteAnalysis(results) {
  const totalVolume = results.reduce(
    (sum, r) => sum + r.cartonDetails.volume,
    0,
  );
  const usedVolume = results.reduce(
    (sum, r) => sum + (r.cartonDetails.volume - r.packingMetrics.wasteSpace),
    0,
  );
  return {
    totalVolume,
    usedVolume,
    wasteVolume: totalVolume - usedVolume,
    wastePercentage:
      totalVolume > 0
        ? Math.round(((totalVolume - usedVolume) / totalVolume) * 100)
        : 0,
  };
}

function calculateStackingAnalysis(results) {
  const totalLayers = results.reduce((sum, r) => sum + r.layout.layers, 0);
  const efficientStacks = results.filter((r) => r.layout.layers > 1).length;
  return {
    averageLayers:
      results.length > 0
        ? toFixedNumber(totalLayers / results.length)
        : 0,
    stackingRate:
      results.length > 0
        ? toFixedNumber((efficientStacks / results.length) * 100)
        : 0,
  };
}

function canFitProductInCarton(product, carton) {
  const dimensions = [product.length, product.breadth, product.height].sort(
    (a, b) => a - b,
  );
  const cartonDimensions = [carton.length, carton.breadth, carton.height].sort(
    (a, b) => a - b,
  );

  return (
    dimensions[0] <= cartonDimensions[0] &&
    dimensions[1] <= cartonDimensions[1] &&
    dimensions[2] <= cartonDimensions[2] &&
    product.weight <= carton.maxWeight
  );
}

function getSmallerBoxRecommendation(
  products,
  cartons,
  allResults,
  overallVolumeEfficiency,
) {
  if (!products?.length || !allResults?.length || overallVolumeEfficiency >= 50) {
    return null;
  }

  const usedVolumeAverage =
    allResults.reduce((sum, result) => sum + result.cartonDetails.volume, 0) /
    allResults.length;
  const firstProduct = products[0];

  const candidate = cartons
    .filter((carton) => carton.availableQuantity > 0)
    .filter((carton) => carton.volume < usedVolumeAverage)
    .filter((carton) => canFitProductInCarton(firstProduct, carton))
    .sort((a, b) => b.volume - a.volume)[0];

  if (!candidate) return null;

  return `Low volume efficiency (${toFixedNumber(overallVolumeEfficiency)}%). Consider smaller box '${candidate.name}' (${toFixedNumber(candidate.length)} x ${toFixedNumber(candidate.breadth)} x ${toFixedNumber(candidate.height)} cm).`;
}

function generatePackingRecommendations(
  results,
  unpackedProducts,
  cartons,
  products,
  overallVolumeEfficiency,
) {
  const recommendations = [];

  const smallerBoxTip = getSmallerBoxRecommendation(
    products,
    cartons,
    results,
    overallVolumeEfficiency,
  );
  if (smallerBoxTip) {
    recommendations.push(smallerBoxTip);
  }

  if (unpackedProducts.length > 0) {
    recommendations.push(
      "Consider adding larger cartons or enabling group reduction to handle remaining items.",
    );

    // Suggest specific carton sizes based on unpacked items
    unpackedProducts.forEach((prod) => {
      const suggestedCarton = cartons.find(
        (c) =>
          c.maxWeight >= prod.weight * Math.min(5, prod.remainingQuantity) &&
          c.volume >= prod.volume * Math.min(5, prod.remainingQuantity),
      );
      if (suggestedCarton) {
        recommendations.push(
          `Use more '${suggestedCarton.name}' for remaining ${prod.productName}.`,
        );
      }
    });
  }

  const inefficientPacks = results.filter(
    (r) => r.efficiency.spaceUtilization < 0.5,
  );
  if (inefficientPacks.length > 0) {
    recommendations.push(
      `${inefficientPacks.length} cartons have < 50% space utilization. Consider using smaller cartons for these items.`,
    );
  }

  return recommendations;
}

function estimateCarbonFootprint(results) {
  // Estimating roughly 0.5kg CO2 per kg of shipping weight + base carton footprint
  const totalWeight = results.reduce(
    (sum, r) =>
      sum +
      (r.itemsPacked *
        r.packingMetrics.weightUtilized *
        r.cartonDetails.maxWeight) /
        100,
    0,
  );
  const cartonFootprint = results.length * 0.2; // 0.2kg per carton manufacturing/disposal
  return Math.round((totalWeight * 0.5 + cartonFootprint) * 100) / 100;
}

function safeSum(items, selector) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((sum, item) => sum + Number(selector(item) || 0), 0);
}

function getCartonVolume(carton) {
  if (!carton) return 0;
  return Number(
    carton?.volume ||
      (Number(carton.length) * Number(carton.breadth) * Number(carton.height)) ||
      0,
  );
}

function getSortedDimensions(entity) {
  return [Number(entity?.length) || 0, Number(entity?.breadth) || 0, Number(entity?.height) || 0].sort(
    (a, b) => a - b,
  );
}

function canFitInAnyOrientation(product, carton) {
  if (!product || !carton) return false;

  const productDimensions = getSortedDimensions(product);
  const cartonDimensions = getSortedDimensions(carton);

  return (
    productDimensions[0] <= cartonDimensions[0] &&
    productDimensions[1] <= cartonDimensions[1] &&
    productDimensions[2] <= cartonDimensions[2]
  );
}

function getLargestAvailableCarton(cartons) {
  if (!Array.isArray(cartons) || cartons.length === 0) return null;

  return cartons.reduce((largest, current) => {
    const largestVolume = getCartonVolume(largest);
    const currentVolume = getCartonVolume(current);
    return currentVolume > largestVolume ? current : largest;
  }, cartons[0]);
}

// Main service function
function calculateOptimalPacking(products, cartons, options = {}) {
  const {
    algorithm = "hybrid",
    costOptimization = true,
    groupReduction = true,
    fragileHandling = true,
  } = options;

  // Initialize the advanced packer
  const packer = new Advanced3DBinPacker();

  const availableBoxes = Array.isArray(cartons) ? cartons.filter(Boolean) : [];
  if (!availableBoxes.length) {
    throw new Error("No boxes found in inventory.");
  }

  // Ensure products is an array
  const productArray = (Array.isArray(products) ? products : [products]).sort(
    (a, b) => (b.weightPerUnitKg || 0) - (a.weightPerUnitKg || 0),
  );

  if (productArray.length === 0) {
    throw new Error("No products provided.");
  }

  for (const product of productArray) {
    const quantity = Number(product?.quantity || 0);
    const length = Number(product?.length || 0);
    const breadth = Number(product?.breadth || 0);
    const height = Number(product?.height || 0);

    if (quantity <= 0 || length <= 0 || breadth <= 0 || height <= 0) {
      throw new Error(
        `Invalid dimensions or quantity for product: ${product?.name || "Unknown"}`,
      );
    }
  }

  const largestAvailableCarton = getLargestAvailableCarton(availableBoxes);
  if (!largestAvailableCarton) {
    throw new Error("No boxes found in inventory.");
  }

  const incompatibleProduct = productArray.find(
    (product) => !canFitInAnyOrientation(product, largestAvailableCarton),
  );
  if (incompatibleProduct) {
    throw new Error(
      "Item is too large for any available carton in your inventory.",
    );
  }

  // Create working copy of cartons with quantities
  const workingCartons = availableBoxes.map((carton, index) => ({
    ...carton,
    originalIndex: index,
    availableQuantity: carton.availableQuantity || 1,
  }));

  // Multi-product processing
  const allResults = [];
  const unpackedProducts = [];

  for (const product of productArray) {
    let remainingQuantity = product.quantity;
    const productResults = [];

    // Use advanced 3D bin packing
    const packingResults = packer.packItems(
      [{ ...product, quantity: remainingQuantity }],
      workingCartons,
      algorithm,
    );

    for (const result of packingResults) {
      if (result.itemsPacked > 0) {
        productResults.push({
          productId: product.id,
          productName: product.name,
          cartonId: result.carton.id,
          cartonDetails: {
            id: result.carton.id,
            name: result.carton.name,
            length: result.carton.length,
            breadth: result.carton.breadth,
            height: result.carton.height,
            maxWeight: result.carton.maxWeight,
            volume: result.carton.volume,
            cost: result.carton.cost,
            priority: result.carton.priority,
          },
          itemsPacked: result.itemsPacked,
          orientation: result.orientation.name,
          orientationIndex: result.orientationIndex,

          // Enhanced metrics
          efficiency: {
            volumeEfficiency: toFixedNumber(result.efficiency.volumeEfficiency),
            spaceUtilization: toFixedNumber(
              result.efficiency.spaceUtilization * 100,
            ),
            weightUtilization: toFixedNumber(result.efficiency.weightUtilization),
          },

          // Layout and stacking information
          layout: {
            arrangement: result.layout.arrangement,
            layers: result.layout.layers,
            itemsPerLayer: result.layout.itemsPerLayer,
            centerOfMass: result.layout.centerOfMass,
          },

          stackingInfo: result.stackingInfo,

          // Cost analysis
          cost: {
            total: toFixedNumber(result.cost),
            breakdown: {
              cartonCost: toFixedNumber(result.carton.cost),
              shippingCost: toFixedNumber(result.carton.shippingCost),
              inefficiencyPenalty: toFixedNumber(
                (1 - result.efficiency.spaceUtilization) * result.carton.cost * 0.5,
              ),
              fragilityPenalty:
                product.isFragile && result.layout.layers > 2
                  ? toFixedNumber(product.damageCost * 0.1)
                  : 0,
            },
          },

          // Orientation and packing details
          orientationDetails: {
            selectedOrientation: result.orientation.name,
            orientationIndex: result.orientationIndex,
            itemsInThisOrientation: result.itemsPacked,
            dimensionsUsed: {
              length: result.layout.packedItems[0]?.dimensions.length || 0,
              breadth: result.layout.packedItems[0]?.dimensions.breadth || 0,
              height: result.layout.packedItems[0]?.dimensions.height || 0,
            },
            arrangementPattern: `${result.layout.arrangement.lengthwise} × ${result.layout.arrangement.breadthwise} × ${result.layout.arrangement.layers}`,
            stackingPattern: {
              itemsPerLayer: result.layout.itemsPerLayer,
              totalLayers: result.layout.layers,
              maxSafeStack: product.maxVerticalStack,
              isOptimalStacking: result.layout.layers > 1,
            },
          },

          // Packing efficiency metrics
          packingMetrics: {
            cartonUtilization: toFixedNumber(
              result.efficiency.spaceUtilization * 100,
            ),
            wasteSpace: toFixedNumber(
              result.carton.volume - result.layout.itemsPacked * product.volume,
            ),
            weightUtilized: toFixedNumber(
              ((result.itemsPacked * product.weight) / result.carton.maxWeight) * 100,
            ),
            spaceOptimality:
              result.layout.itemsPerLayer > 1 ? "Good" : "Could be improved",
            constraintMessages: result.layout.constraintMessages || [],
          },

          packingOrder: allResults.length + 1,
          timestamp: new Date().toISOString(),
        });

        remainingQuantity -= result.itemsPacked;

        // Update carton availability
        const cartonIndex = workingCartons.findIndex(
          (c) => c.id === result.carton.id,
        );
        if (cartonIndex >= 0) {
          workingCartons[cartonIndex].availableQuantity--;
        }
      }
    }

    allResults.push(...productResults);

    if (remainingQuantity > 0) {
      unpackedProducts.push({
        productId: product.id,
        productName: product.name,
        remainingQuantity: remainingQuantity,
        reason: "Insufficient carton space or weight capacity",
      });
    }
  }

  // Group reduction optimization
  if (groupReduction && allResults.length > 1) {
    // Attempt to consolidate items across fewer cartons.
  }

  // Calculate comprehensive summary
  const totalItemsPacked = safeSum(allResults, (result) => result.itemsPacked);
  const totalRequestedItems = safeSum(productArray, (product) => product.quantity);
  const totalCartonsUsed = allResults.length;
  const totalCost = safeSum(allResults, (result) => result.cost?.total);
  const totalPackedItemVolume = safeSum(
    allResults,
    (result) => (result.itemsPacked || 0) * (result.product?.volume || 0),
  );
  const totalUsedCartonVolume = safeSum(
    allResults,
    (result) => result.cartonDetails?.volume || 0,
  );
  const overallVolumeEfficiency = clamp(
    totalUsedCartonVolume > 0
      ? (totalPackedItemVolume / totalUsedCartonVolume) * 100
      : 0,
    0,
    100,
  );
  const totalWeightGrams = safeSum(
    allResults,
    (result) => (result.itemsPacked || 0) * (result.product?.weight || 0),
  );

  // Carton type analysis
  const cartonTypeAnalysis = {};
  allResults.forEach((result) => {
    const key = `${result.cartonDetails?.length || 0}×${result.cartonDetails?.breadth || 0}×${result.cartonDetails?.height || 0}`;
    if (!cartonTypeAnalysis[key]) {
      cartonTypeAnalysis[key] = {
        cartonType: key,
        count: 0,
        totalItems: 0,
        totalCost: 0,
        avgEfficiency: 0,
        cartonDetails: result.cartonDetails,
      };
    }
    cartonTypeAnalysis[key].count++;
    cartonTypeAnalysis[key].totalItems += result.itemsPacked || 0;
    cartonTypeAnalysis[key].totalCost += result.cost?.total || 0;
    cartonTypeAnalysis[key].avgEfficiency += result.efficiency?.volumeEfficiency || 0;
  });

  // Calculate averages for carton type analysis
  Object.values(cartonTypeAnalysis).forEach((analysis) => {
    analysis.avgEfficiency = toFixedNumber(analysis.avgEfficiency / analysis.count);
    analysis.avgCostPerCarton = toFixedNumber(analysis.totalCost / analysis.count);
    analysis.totalCost = toFixedNumber(analysis.totalCost);
  });

  const groupedCartonCost = safeSum(
    Object.values(cartonTypeAnalysis),
    (cartonData) => cartonData.totalCost,
  );
  const shippingRatePerKg = 18;
  const fragileHandlingFee = productArray.some((product) => product.isFragile)
    ? 35
    : 0;
  const totalWeightKg = totalWeightGrams / 1000;
  const shippingCostByWeight = totalWeightKg * shippingRatePerKg;
  const estimatedCost =
    groupedCartonCost + shippingCostByWeight + fragileHandlingFee;

  if (totalItemsPacked === 0) {
    const anyProductFits = productArray.some((product) =>
      availableBoxes.some((carton) => canFitInAnyOrientation(product, carton)),
    );

    if (!anyProductFits) {
      throw new Error("No suitable box found.");
    }

    throw new Error("Stacking constraints prevent packing.");
  }

  // Advanced analytics
  const analytics = {
    packingQuality: {
      overallScore: calculateOverallPackingScore(allResults),
      wasteAnalysis: calculateWasteAnalysis(allResults),
      stackingAnalysis: calculateStackingAnalysis(allResults),
      costEfficiency:
        totalItemsPacked > 0
          ? toFixedNumber(totalCost / totalItemsPacked)
          : 0,
    },
    recommendations: generatePackingRecommendations(
      allResults,
      unpackedProducts,
      cartons,
      productArray,
      overallVolumeEfficiency,
    ),
    sustainability: {
      totalWasteVolume: toFixedNumber(
        allResults.reduce((sum, result) => sum + result.packingMetrics.wasteSpace, 0),
      ),
      packingDensity: toFixedNumber(
        totalItemsPacked > 0 ? allResults.length / totalItemsPacked : 0,
      ),
      carbonFootprint: toFixedNumber(estimateCarbonFootprint(allResults)),
    },
  };

  return {
    packingResults: allResults,
    unpackedProducts: unpackedProducts,
    remainingQuantity: totalRequestedItems - totalItemsPacked,
    summary: {
      totalItemsRequested: totalRequestedItems,
      totalItemsPacked: totalItemsPacked,
      totalCartonsUsed: totalCartonsUsed,
      packingSuccess: unpackedProducts.length === 0,
      packingRate: toFixedNumber((totalItemsPacked / totalRequestedItems) * 100),
      overallVolumeEfficiency: toFixedNumber(overallVolumeEfficiency),
      totalCost: toFixedNumber(totalCost),
      totalWeightKg: toFixedNumber(totalWeightKg),
      estimatedCost: {
        total: toFixedNumber(estimatedCost),
        breakdown: {
          cartonBaseCost: toFixedNumber(groupedCartonCost),
          shippingRatePerKg: toFixedNumber(shippingRatePerKg),
          shippingCostByWeight: toFixedNumber(shippingCostByWeight),
          fragileHandlingFee: toFixedNumber(fragileHandlingFee),
        },
      },
      cartonTypeBreakdown: Object.values(cartonTypeAnalysis),
      algorithmUsed: algorithm,
      optimizationApplied: {
        costOptimization,
        groupReduction,
        fragileHandling,
        stackingOptimization: true,
        orientationOptimization: true,
      },
    },
    analytics: analytics,
  };
}

export { calculateOptimalPacking, Product, Carton };
