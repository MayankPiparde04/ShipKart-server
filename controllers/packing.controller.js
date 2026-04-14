import {
  calculateOptimalPacking,
  Product,
  Carton,
} from "../services/packing.service.js";
import BoxData from "../models/box.model.js";

function canFitInAnyRotation(product, carton) {
  const productDimensions = [product.length, product.breadth, product.height]
    .map((value) => Number(value) || 0)
    .sort((a, b) => a - b);
  const cartonDimensions = [carton.length, carton.breadth, carton.height]
    .map((value) => Number(value) || 0)
    .sort((a, b) => a - b);

  return (
    productDimensions[0] <= cartonDimensions[0] &&
    productDimensions[1] <= cartonDimensions[1] &&
    productDimensions[2] <= cartonDimensions[2]
  );
}

function getLargestCarton(cartons) {
  if (!Array.isArray(cartons) || cartons.length === 0) return null;

  return cartons.reduce((largest, current) => {
    const largestVolume =
      Number(largest.volume) ||
      Number(largest.length) * Number(largest.breadth) * Number(largest.height) ||
      0;
    const currentVolume =
      Number(current.volume) ||
      Number(current.length) * Number(current.breadth) * Number(current.height) ||
      0;

    return currentVolume > largestVolume ? current : largest;
  }, cartons[0]);
}

function mapPackingErrorMessage(message) {
  if (message.includes("No boxes found in inventory")) {
    return "No suitable box found.";
  }

  if (message.includes("Item is too large for any available carton")) {
    return "No suitable box found.";
  }

  if (message.includes("Stacking constraints prevent packing")) {
    return "Stacking constraints prevent packing.";
  }

  if (message.includes("No suitable box found")) {
    return "No suitable box found.";
  }

  return null;
}

// Enhanced endpoint for multiple products packing
export const enhancedPacking = async (req, res) => {
  try {
    const { products, cartons: customCartons, options } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Products array is required and cannot be empty",
      });
    }

    // Fetch cartons if not provided
    let cartons = [];
    if (
      customCartons &&
      Array.isArray(customCartons) &&
      customCartons.length > 0
    ) {
      cartons = customCartons.map(
        (c) =>
          new Carton(
            Number.parseFloat(c.length),
            Number.parseFloat(c.breadth),
            Number.parseFloat(c.height),
            Number.parseFloat(c.maxWeight),
            {
              id: c.id,
              name: c.name,
              cost: c.cost,
              availableQuantity: c.quantity || 100,
            },
          ),
      );
    } else {
      // Fetch from database
      const dbBoxes = await BoxData.find({});
      if (dbBoxes.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "No cartons found in database. Please provide cartons or add to inventory.",
        });
      }

      cartons = dbBoxes
        .map((box) => {
          // Box model stores dimensions in INCHES and weight in KG
          // Item dimensions are in CM and weight in GRAMS → convert to match
          const l = (Number.parseFloat(box.length) || 0) * 2.54; // inches → cm
          const b = (Number.parseFloat(box.breadth) || 0) * 2.54; // inches → cm
          const h = (Number.parseFloat(box.height) || 0) * 2.54; // inches → cm
          const mw = (Number.parseFloat(box.max_weight) || 0) * 1000; // kg → grams

          if (l <= 0 || b <= 0 || h <= 0 || mw <= 0) {
            console.warn(
              `Skipping invalid box: ${box.box_name} (missing dimensions/weight)`,
            );
            return null;
          }

          return new Carton(l, b, h, mw, {
            id: box._id.toString(),
            name: box.box_name,
            // Default to 100 if quantity is 0/unset so the algorithm doesn't skip it
            availableQuantity:
              Number.parseInt(box.quantity, 10) > 0
                ? Number.parseInt(box.quantity, 10)
                : 100,
          });
        })
        .filter(Boolean); // remove null entries from invalid boxes
    }

    // Prepare products
    const productObjects = products.map((p) => {
      const l = Number.parseFloat(p.length) || 0;
      const b = Number.parseFloat(p.breadth) || 0;
      const h = Number.parseFloat(p.height) || 0;
      const w = Number.parseFloat(p.weight) || 0;
      const q = Number.parseInt(p.quantity, 10) || 1;

      if (l <= 0 || b <= 0 || h <= 0 || w <= 0 || q <= 0) {
        throw new Error(
          `Invalid dimensions or quantity for product: ${p.name || "Unknown"}`,
        );
      }

      return new Product(l, b, h, w, q, {
        id: p.id,
        name: p.name,
        isFragile: p.isFragile,
        value: p.price,
        weightPerUnitKg: Number.parseFloat(p.weight_per_unit) || undefined,
        maxVerticalStack:
          Number.parseInt(p.max_vertical_stack, 10) || undefined,
        crushResistanceKg:
          Number.parseFloat(p.crush_resistance_kg) || undefined,
        leakageRisk: p.leakage_risk || undefined,
      });
    });

    const largestCarton = getLargestCarton(cartons);
    if (!largestCarton) {
      return res.status(400).json({
        success: false,
        message: "No suitable box found.",
      });
    }

    const incompatibleProduct = productObjects.find(
      (product) => !canFitInAnyRotation(product, largestCarton),
    );

    if (incompatibleProduct) {
      return res.status(400).json({
        success: false,
        message:
          "Item is too large for any available carton in your inventory.",
      });
    }

    // Calculate packing
    const result = calculateOptimalPacking(productObjects, cartons, options);

    res.status(200).json({
      success: true,
      message: "Enhanced packing calculation completed successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error in enhanced packing:", error?.stack || error);

    const mappedMessage = mapPackingErrorMessage(error?.message || "");
    if (mappedMessage) {
      return res.status(400).json({
        success: false,
        message: mappedMessage,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error calculating packing solution",
      error: error.message,
    });
  }
};

// Original endpoint wrapping the new logic for backward compatibility
export const optimalPacking = async (req, res) => {
  try {
    const { product, cartons, options } = req.body;

    if (!product || !cartons) {
      return res.status(400).json({
        success: false,
        message: "Product and cartons are required",
      });
    }

    const pL = Number.parseFloat(product.length) || 0;
    const pB = Number.parseFloat(product.breadth) || 0;
    const pH = Number.parseFloat(product.height) || 0;
    const pW = Number.parseFloat(product.weight) || 0;
    const pQ = Number.parseInt(product.quantity, 10) || 1;

    if (pL <= 0 || pB <= 0 || pH <= 0 || pW <= 0 || pQ <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing product dimensions/quantity",
      });
    }

    const productObj = new Product(pL, pB, pH, pW, pQ, {
      name: "Single Product",
    });

    const cartonObjs = cartons.map(
      (c) =>
        new Carton(
          Number.parseFloat(c.length),
          Number.parseFloat(c.breadth),
          Number.parseFloat(c.height),
          Number.parseFloat(c.maxWeight),
          { availableQuantity: 100 }, // Default high quantity for single calc
        ),
    );

    const result = calculateOptimalPacking([productObj], cartonObjs, options);

    res.status(200).json({
      success: true,
      message: "Optimal packing calculation completed successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error in optimal packing:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating packing solution",
      error: error.message,
    });
  }
};
