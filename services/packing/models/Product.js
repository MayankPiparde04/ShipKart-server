/** Product model with fragility and stacking rules */
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
    this.density = normalizedWeight / this.volume;

    this.weightPerUnitKg =
      Number(options.weightPerUnitKg) > 0
        ? Number(options.weightPerUnitKg)
        : normalizedWeight / 1000;
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

    this.isFragile = options.isFragile || false;
    this.maxStackHeight = options.maxStackHeight || this.maxVerticalStack || Math.floor(normalizedHeight * 10);
    this.maxStackWeight = options.maxStackWeight || normalizedWeight * 50;
    this.canRotate = options.canRotate !== false;
    this.mustStayUpright = options.mustStayUpright === true || options.upright === true;
    this.noStackAbove = options.noStackAbove === true || this.leakageRisk === "High";
    this.priority = options.priority || 1;

    this.value = options.value || 0;
    this.damageCost = options.damageCost || this.value * 0.1;
  }
}

export default Product;
