/** Carton/box container model with cost and priority */
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
    const normalizedAvailable = Number.parseInt(options.availableQuantity, 10);
    this.availableQuantity =
      Number.isInteger(normalizedAvailable) && normalizedAvailable >= 0 ? normalizedAvailable : 1;

    this.cost = Number.isFinite(Number(options.cost)) ? Number(options.cost) : 0;
    this.shippingCost = 0;
    this.priority = options.priority || 1;
    this.popularity = options.popularity || 0;

    this.fragileSupport = options.fragileSupport !== false;
    this.maxStackLayers = options.maxStackLayers || 10;
  }
}

export default Carton;
