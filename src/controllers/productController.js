import Product from "../models/Product.js";

// @desc    Create a new product
// @route   POST /api/products
// @access  Public/Private (adjust as needed)
export const createProduct = async (req, res) => {
  try {
    const { productName, description, price, discount, category, image } =
      req.body;

    // Validate required fields
    if (!productName || !description || !price || !category || !image) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide all required fields: productName, description, price, category, and image",
      });
    }

    // Validate base64 image format
    if (!image.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid image format. Please provide a valid base64 image string",
      });
    }

    // Check if product with same name already exists (optional)
    const existingProduct = await Product.findOne({ productName });
    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: "A product with this name already exists",
      });
    }

    // Create new product
    const product = new Product({
      productName,
      description,
      price: parseFloat(price),
      discount: discount ? parseFloat(discount) : 0,
      category,
      image,
      // Status will default to 'In Stock' as per schema
    });

    const savedProduct = await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: savedProduct,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public/Private
export const getAllProducts = async (req, res) => {
  try {
    const { category, status, page = 1, limit = 10, search } = req.query;

    // Build filter object
    const filter = {};

    if (category) filter.category = category;
    if (status) filter.status = status;

    // Search in productName and description
    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("-__v"); // Exclude version key

    const total = await Product.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data: {
        products,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        totalProducts: total,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public/Private
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select("-__v");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Public/Private
export const updateProduct = async (req, res) => {
  try {
    const {
      productName,
      description,
      price,
      discount,
      status,
      category,
      image,
    } = req.body;

    // Check if product exists
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check for duplicate product name (excluding current product)
    if (productName && productName !== existingProduct.productName) {
      const duplicateProduct = await Product.findOne({
        productName,
        _id: { $ne: req.params.id },
      });
      if (duplicateProduct) {
        return res.status(409).json({
          success: false,
          message: "A product with this name already exists",
        });
      }
    }

    // Validate base64 image if provided
    if (image && !image.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid image format. Please provide a valid base64 image string",
      });
    }

    const updateData = {};
    if (productName) updateData.productName = productName;
    if (description) updateData.description = description;
    if (price) updateData.price = parseFloat(price);
    if (discount !== undefined) updateData.discount = parseFloat(discount);
    if (status) updateData.status = status;
    if (category) updateData.category = category;
    if (image) updateData.image = image;

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select("-__v");

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Public/Private
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Update product status
// @route   PATCH /api/products/:id/status
// @access  Public/Private
export const updateProductStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const validStatuses = [
      "In Stock",
      "Out of Stock",
      "Available",
      "Unavailable",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).select("-__v");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product status updated successfully",
      data: product,
    });
  } catch (error) {
    console.error("Error updating product status:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getSimilarProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query; // Default to 4 similar products

    // Find the current product
    const currentProduct = await Product.findById(id);

    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Build query for similar products
    const similarProducts = await Product.find({
      _id: { $ne: id }, // Exclude the current product
      category: currentProduct.category, // Same category
      status: { $in: ["In Stock", "Available"] }, // Only available products
    })
      .select("-__v")
      .limit(parseInt(limit))
      .sort({ createdAt: -1 }); // Get latest products first

    // If no similar products found in same category, try to get any available products
    let fallbackProducts = [];
    if (similarProducts.length === 0) {
      fallbackProducts = await Product.find({
        _id: { $ne: id },
        status: { $in: ["In Stock", "Available"] },
      })
        .select("-__v")
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });
    }

    const products =
      similarProducts.length > 0 ? similarProducts : fallbackProducts;

    res.status(200).json({
      success: true,
      message:
        similarProducts.length > 0
          ? "Similar products retrieved successfully"
          : "Alternative products retrieved successfully",
      data: {
        currentProduct: {
          _id: currentProduct._id,
          productName: currentProduct.productName,
          category: currentProduct.category,
        },
        similarProducts: products,
        total: products.length,
      },
    });
  } catch (error) {
    console.error("Error fetching similar products:", error);
    if (error.kind === "ObjectId") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Export all functions as default
const productController = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  updateProductStatus,
  getSimilarProducts,
};

export default productController;
