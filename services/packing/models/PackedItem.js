/** Represents a product positioned in 3D space within a carton */
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
      [product.length, product.breadth, product.height],
      [product.length, product.height, product.breadth],
      [product.breadth, product.length, product.height],
      [product.breadth, product.height, product.length],
      [product.height, product.length, product.breadth],
      [product.height, product.breadth, product.length],
    ];
    const [l, b, h] = orientations[orientation];
    return { length: l, breadth: b, height: h };
  }
}

export default PackedItem;
