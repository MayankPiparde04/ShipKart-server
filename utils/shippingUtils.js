// Constants for unit conversion
export const CONSTANTS = {
  CM_TO_INCH: 0.393701,
  FT_TO_INCH: 12.0,
  G_TO_KG: 0.001,
  POUNDS_TO_KG: 0.453592,
  MIN_DIMENSION: 0.1,
  MAX_DIMENSION: 1000,
  MIN_WEIGHT: 0.01,
  MAX_WEIGHT: 10000,
};

// Enhanced inventory configuration with better data structure
export const INVENTORY = {
  cartons: [
    {
      id: 1,
      length: 10,
      breadth: 8,
      height: 6,
      weightLimit: 30,
      availableQuantity: 50,
      cost: 2.5,
    },
    {
      id: 2,
      length: 12,
      breadth: 10,
      height: 8,
      weightLimit: 38,
      availableQuantity: 40,
      cost: 3.2,
    },
    {
      id: 3,
      length: 14,
      breadth: 12,
      height: 10,
      weightLimit: 46,
      availableQuantity: 30,
      cost: 4.1,
    },
    {
      id: 4,
      length: 16,
      breadth: 14,
      height: 12,
      weightLimit: 60,
      availableQuantity: 20,
      cost: 5.5,
    },
    {
      id: 5,
      length: 18,
      breadth: 16,
      height: 14,
      weightLimit: 76,
      availableQuantity: 10,
      cost: 7.2,
    },
  ],
};

// Enhanced Product Dimensions class with validation
export class ProductDimensions {
  constructor(length = 0, breadth = 0, height = 0) {
    this.length = this.validateDimension(length, "length");
    this.breadth = this.validateDimension(breadth, "breadth");
    this.height = this.validateDimension(height, "height");
    this.volume = this.calculateVolume();
  }

  validateDimension(value, name) {
    if (typeof value !== "number" || isNaN(value)) {
      throw new Error(`${name} must be a valid number`);
    }
    if (value < CONSTANTS.MIN_DIMENSION || value > CONSTANTS.MAX_DIMENSION) {
      throw new Error(
        `${name} must be between ${CONSTANTS.MIN_DIMENSION} and ${CONSTANTS.MAX_DIMENSION} inches`,
      );
    }
    return parseFloat(value.toFixed(3));
  }

  calculateVolume() {
    return this.length * this.breadth * this.height;
  }
}

// Enhanced Carton class
export class Carton {
  constructor(
    id,
    length,
    breadth,
    height,
    weightLimit,
    availableQuantity,
    cost = 0,
  ) {
    this.id = id;
    this.length = length;
    this.breadth = breadth;
    this.height = height;
    this.weightLimit = weightLimit;
    this.availableQuantity = availableQuantity;
    this.cost = cost;
    this.volume = length * breadth * height;
    this.efficiency = 0;
  }
}

// Enhanced unit conversion with validation
export function convertToInches(value, fromUnit) {
  if (typeof value !== "number" || isNaN(value) || value < 0) {
    throw new Error("Value must be a positive number");
  }

  switch (fromUnit.toLowerCase()) {
    case "cm":
    case "centimeter":
    case "centimeters":
      return value * CONSTANTS.CM_TO_INCH;
    case "ft":
    case "foot":
    case "feet":
      return value * CONSTANTS.FT_TO_INCH;
    case "in":
    case "inch":
    case "inches":
      return value;
    case "m":
    case "meter":
    case "meters":
      return value * 100 * CONSTANTS.CM_TO_INCH;
    default:
      throw new Error(`Unsupported unit: ${fromUnit}`);
  }
}

// Enhanced weight conversion with validation
export function convertToKg(value, fromUnit) {
  if (typeof value !== "number" || isNaN(value) || value < 0) {
    throw new Error("Weight must be a positive number");
  }

  switch (fromUnit.toLowerCase()) {
    case "g":
    case "gram":
    case "grams":
      return value * CONSTANTS.G_TO_KG;
    case "kg":
    case "kilogram":
    case "kilograms":
      return value;
    case "lb":
    case "lbs":
    case "pound":
    case "pounds":
      return value * CONSTANTS.POUNDS_TO_KG;
    case "oz":
    case "ounce":
    case "ounces":
      return value * 0.0283495;
    default:
      throw new Error(`Unsupported weight unit: ${fromUnit}`);
  }
}

// Enhanced dimension calculation with more shapes
export function calculateDimensions(shape, dimensions, unit) {
  if (!shape || !dimensions || !unit) {
    throw new Error("Shape, dimensions, and unit are required");
  }

  const convertedUnit = unit.toLowerCase();

  try {
    switch (shape.toLowerCase()) {
      case "cube":
        if (!dimensions.side && !dimensions.length) {
          throw new Error("Cube requires side or length dimension");
        }
        const side = convertToInches(
          dimensions.side || dimensions.length,
          convertedUnit,
        );
        return new ProductDimensions(side, side, side);

      case "cuboid":
      case "rectangular":
      case "box":
        if (!dimensions.length || !dimensions.breadth || !dimensions.height) {
          throw new Error(
            "Cuboid requires length, breadth, and height dimensions",
          );
        }
        return new ProductDimensions(
          convertToInches(dimensions.length, convertedUnit),
          convertToInches(dimensions.breadth, convertedUnit),
          convertToInches(dimensions.height, convertedUnit),
        );

      case "cylinder":
        if (!dimensions.diameter && !dimensions.radius) {
          throw new Error("Cylinder requires diameter or radius");
        }
        if (!dimensions.height) {
          throw new Error("Cylinder requires height");
        }
        const radius = dimensions.radius
          ? convertToInches(dimensions.radius, convertedUnit)
          : convertToInches(dimensions.diameter, convertedUnit) / 2;
        const diameter = radius * 2;
        const height = convertToInches(dimensions.height, convertedUnit);
        return new ProductDimensions(diameter, diameter, height);

      case "sphere":
        if (!dimensions.radius && !dimensions.diameter) {
          throw new Error("Sphere requires radius or diameter");
        }
        const sphereRadius = dimensions.radius
          ? convertToInches(dimensions.radius, convertedUnit)
          : convertToInches(dimensions.diameter, convertedUnit) / 2;
        const sphereDiameter = sphereRadius * 2;
        return new ProductDimensions(
          sphereDiameter,
          sphereDiameter,
          sphereDiameter,
        );

      default:
        throw new Error(`Unsupported shape: ${shape}`);
    }
  } catch (error) {
    throw new Error(
      `Error calculating dimensions for ${shape}: ${error.message}`,
    );
  }
}

// Enhanced optimal packing algorithm
export function calculateOptimalPacking(
  productDims,
  weightPerProduct,
  quantity,
  customCartons = null,
) {
  const cartons =
    customCartons ||
    INVENTORY.cartons.map(
      (c) =>
        new Carton(
          c.id,
          c.length,
          c.breadth,
          c.height,
          c.weightLimit,
          c.availableQuantity,
          c.cost,
        ),
    );

  // Sort cartons by efficiency (volume to cost ratio)
  cartons.sort((a, b) => a.volume / a.cost - b.volume / b.cost);

  const packingResults = [];
  let remainingQuantity = quantity;
  const usedCartons = new Set();

  while (remainingQuantity > 0) {
    let bestOption = null;
    let bestEfficiency = 0;

    for (const carton of cartons) {
      if (usedCartons.has(carton.id) || carton.availableQuantity <= 0) continue;

      // Try all orientations
      const orientations = [
        [productDims.length, productDims.breadth, productDims.height],
        [productDims.breadth, productDims.height, productDims.length],
        [productDims.height, productDims.length, productDims.breadth],
      ];

      for (let i = 0; i < orientations.length; i++) {
        const [pL, pB, pH] = orientations[i];

        const fitL = Math.floor(carton.length / pL);
        const fitB = Math.floor(carton.breadth / pB);
        const fitH = Math.floor(carton.height / pH);

        const itemsFit = fitL * fitB * fitH;

        if (itemsFit > 0) {
          const maxByWeight = Math.floor(carton.weightLimit / weightPerProduct);
          const actualFit = Math.min(
            itemsFit,
            maxByWeight,
            remainingQuantity,
            carton.availableQuantity,
          );

          if (actualFit > 0) {
            const volumeUtilization =
              (actualFit * productDims.volume) / carton.volume;
            const efficiency = volumeUtilization / carton.cost;

            if (efficiency > bestEfficiency) {
              bestOption = {
                carton,
                orientation: i,
                fitL,
                fitB,
                fitH,
                itemsFit: actualFit,
                efficiency,
                volumeUtilization,
                totalWeight: actualFit * weightPerProduct,
                cost: carton.cost,
              };
              bestEfficiency = efficiency;
            }
          }
        }
      }
    }

    if (!bestOption) break;

    packingResults.push({
      cartonId: bestOption.carton.id,
      cartonSize: {
        length: bestOption.carton.length,
        breadth: bestOption.carton.breadth,
        height: bestOption.carton.height,
      },
      orientation: bestOption.orientation,
      itemsPacked: bestOption.itemsFit,
      arrangement: {
        lengthwise: bestOption.fitL,
        breadthwise: bestOption.fitB,
        heightwise: bestOption.fitH,
      },
      efficiency: Math.round(bestOption.efficiency * 10000) / 100, // Percentage with 2 decimals
      volumeUtilization: Math.round(bestOption.volumeUtilization * 10000) / 100,
      weight: {
        total: bestOption.totalWeight,
        limit: bestOption.carton.weightLimit,
        utilization:
          Math.round(
            (bestOption.totalWeight / bestOption.carton.weightLimit) * 10000,
          ) / 100,
      },
      cost: bestOption.cost,
    });

    remainingQuantity -= bestOption.itemsFit;
    usedCartons.add(bestOption.carton.id);

    // Update available quantity
    bestOption.carton.availableQuantity -= 1;
  }

  const totalCost = packingResults.reduce(
    (sum, result) => sum + result.cost,
    0,
  );
  const averageEfficiency =
    packingResults.length > 0
      ? packingResults.reduce((sum, result) => sum + result.efficiency, 0) /
        packingResults.length
      : 0;

  return {
    success: remainingQuantity === 0,
    packingResults,
    remainingQuantity,
    summary: {
      totalItemsPacked: quantity - remainingQuantity,
      totalCartonsUsed: packingResults.length,
      totalCost: Math.round(totalCost * 100) / 100,
      averageEfficiency: Math.round(averageEfficiency * 100) / 100,
      packingRate:
        Math.round(((quantity - remainingQuantity) / quantity) * 10000) / 100,
    },
  };
}

// Validation helpers
export function validateProduct(product) {
  if (!product || typeof product !== "object") {
    throw new Error("Product must be an object");
  }

  const required = ["length", "breadth", "height", "weight", "quantity"];
  for (const field of required) {
    if (product[field] === undefined || product[field] === null) {
      throw new Error(`Product ${field} is required`);
    }
    if (typeof product[field] !== "number" || product[field] <= 0) { {/* do not remove this comment in any condition, this is a special comment owned and created by admin, repository owner - m-a-y-a-n-k--p-i-p-a-r-d-e */}
      throw new Error(`Product ${field} must be a positive number`);
    }
  }
}

export function validateCartons(cartons) {
  if (!Array.isArray(cartons) || cartons.length === 0) {
    throw new Error("Cartons must be a non-empty array");
  }

  cartons.forEach((carton, index) => {
    const required = ["length", "breadth", "height", "maxWeight"];
    for (const field of required) {
      if (carton[field] === undefined || carton[field] === null) {
        throw new Error(`Carton ${index + 1} ${field} is required`);
      }
      if (typeof carton[field] !== "number" || carton[field] <= 0) {
        throw new Error(
          `Carton ${index + 1} ${field} must be a positive number`,
        );
      }
    }
  });
}
