import {
  calculateOptimalPacking,
  Product,
  Carton,
} from "../services/packing.service.js";

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
  if (message.includes("Insufficient inventory")) {
    return "Insufficient inventory";
  }

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

function normalizeOrientation(orientation) {
  const orientationLabels = {
    0: "Standing Upright",
    1: "Lying on Side",
    2: "Standing Upright",
    3: "Lying on Side",
    4: "Lying Flat",
    5: "Lying Flat",
  };
  const orientationAlias = {
    "L×B×H": "Standing Upright",
    "B×L×H": "Standing Upright",
    "L×H×B": "Lying on Side",
    "B×H×L": "Lying on Side",
    "H×L×B": "Lying Flat",
    "H×B×L": "Lying Flat",
  };

  const deriveAliasFromWords = (value) => {
    if (typeof value !== "string") return null;
    const lettersOnly = value.toUpperCase().replaceAll(/[^LBH]/g, "");
    const wordAliasMap = {
      LBH: "Standing Upright",
      BLH: "Standing Upright",
      LHB: "Lying on Side",
      BHL: "Lying on Side",
      HLB: "Lying Flat",
      HBL: "Lying Flat",
    };
    return wordAliasMap[lettersOnly] || null;
  };

  if (typeof orientation === "string") {
    return (
      orientationAlias[orientation] ||
      deriveAliasFromWords(orientation) ||
      orientation
    );
  }
  if (Number.isInteger(orientation) && orientationLabels[orientation]) {
    return orientationLabels[orientation];
  }
  if (orientation && typeof orientation.name === "string") {
    return orientation.name;
  }
  return null;
}

// Enhanced endpoint for multiple products packing
export const enhancedPacking = async (req, res) => {
  try {
    const { selectedItems, availableBoxes, options } = req.body;
    const legacyBoxes = req.body?.boxes;
    const legacyBoxData = req.body?.boxData;
    const products = selectedItems;
    const boxes = availableBoxes;

    console.log("Boxes Sync Check:", Array.isArray(availableBoxes) ? availableBoxes.length : 0);

    if (
      (!Array.isArray(availableBoxes) || availableBoxes.length === 0) &&
      ((Array.isArray(legacyBoxes) && legacyBoxes.length > 0) ||
        (Array.isArray(legacyBoxData) && legacyBoxData.length > 0))
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Payload mismatch: use 'availableBoxes' (not 'boxes' or 'boxData') in /optimal-analysis request body.",
      });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "selectedItems array is required and cannot be empty",
      });
    }

    if (!boxes || !Array.isArray(boxes) || boxes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "availableBoxes array is required and cannot be empty",
      });
    }

    const cartons = boxes
      .map((box) => {
        const l = Number.parseFloat(box.length ?? box.boxLength ?? box.L ?? 0);
        const b = Number.parseFloat(box.width ?? box.breadth ?? box.boxWidth ?? box.W ?? 0);
        const h = Number.parseFloat(box.height ?? box.boxHeight ?? box.H ?? 0);
        const mw = Number.parseFloat(
          box.maxWeight ?? box.max_weight ?? box.maxWeightCapacity ?? 0,
        );
        const boxCost = Number.parseFloat(box?.cost ?? box?.price ?? 0) || 0;

        if (l <= 0 || b <= 0 || h <= 0 || mw <= 0) {
          console.warn(
            `[Packing] Skipping invalid provided box: ${box?.boxName || box?.name || box?.box_name || "unknown"}`,
          );
          return null;
        }

        return new Carton(l, b, h, mw, {
          id: String(box?._id || box?.id || ""),
          name: box?.boxName || box?.name || box?.box_name || "Box",
          cost: boxCost,
          availableQuantity: Math.max(0, Number.parseInt(box.quantity, 10) || 0),
        });
      })
      .filter(Boolean);

    if (!cartons.length) {
      return res.status(400).json({
        success: false,
        message: "No valid boxes were provided in availableBoxes",
      });
    }

    // Prepare products
    const productObjects = products.map((p) => {
      const l = Number.parseFloat(p.length ?? p.dimensions?.length) || 0;
      const b = Number.parseFloat(p.breadth ?? p.width ?? p.dimensions?.breadth ?? p.dimensions?.width) || 0;
      const h = Number.parseFloat(p.height ?? p.dimensions?.height) || 0;
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
        // Compare item grams against carton maxWeight (kg).
        weightPerUnitKg:
          Number.parseFloat(p.weight_per_unit ?? p.weight) > 0
            ? Number.parseFloat(p.weight_per_unit ?? p.weight) / 1000
            : undefined,
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

    const boxById = new Map(
      boxes.map((box) => [String(box?._id || box?.id || ""), box]),
    );
    const boxByName = new Map(
      boxes.map((box) => [String(box?.boxName || box?.box_name || box?.name || ""), box]),
    );

    const enrichedPackingResults = (result?.packingResults || []).map((entry, index) => {
      const cartonId = String(
        entry?.cartonDetails?.id || entry?.carton?.id || entry?.carton?._id || "",
      );
      const cartonName = String(
        entry?.cartonDetails?.name || entry?.carton?.name || "",
      );

      const syncedBox =
        boxById.get(cartonId) || boxByName.get(cartonName) || boxes[index] || null;

      const boxLength = Number.parseFloat(
        syncedBox?.length ??
          syncedBox?.boxLength ??
          entry?.cartonDetails?.length ??
          entry?.carton?.length ??
          0,
      ) || 0;
      const boxWidth = Number.parseFloat(
        syncedBox?.width ??
          syncedBox?.breadth ??
          syncedBox?.boxWidth ??
          entry?.cartonDetails?.width ??
          entry?.cartonDetails?.breadth ??
          entry?.carton?.width ??
          entry?.carton?.breadth ??
          0,
      ) || 0;
      const boxHeight = Number.parseFloat(
        syncedBox?.height ??
          syncedBox?.boxHeight ??
          entry?.cartonDetails?.height ??
          entry?.carton?.height ??
          0,
      ) || 0;
      const normalizedOrientation = normalizeOrientation(entry?.orientation);

      return {
        ...entry,
        orientation: normalizedOrientation,
        cartonDetails: {
          ...entry?.cartonDetails,
          id: cartonId || String(syncedBox?._id || syncedBox?.id || ""),
          name:
            entry?.cartonDetails?.name ||
            syncedBox?.boxName ||
            syncedBox?.box_name ||
            syncedBox?.name ||
            entry?.carton?.name ||
            "Box",
          boxLength,
          boxWidth,
          boxHeight,
          length: boxLength,
          width: boxWidth,
          breadth: boxWidth,
          height: boxHeight,
          volume:
            Number.parseFloat(entry?.cartonDetails?.volume) ||
            Number.parseFloat(entry?.carton?.volume) ||
            (boxLength > 0 && boxWidth > 0 && boxHeight > 0
              ? boxLength * boxWidth * boxHeight
              : 0),
          orientation: normalizedOrientation,
        },
      };
    });

    res.status(200).json({
      success: true,
      message: "Enhanced packing calculation completed successfully",
      ...result,
      packingResults: enrichedPackingResults,
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
