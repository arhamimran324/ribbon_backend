// controllers/feedbackController.js
import Feedback from "../models/Feedback.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

// @desc    Submit feedback for a product
// @route   POST /api/feedback
// @access  Private
export const submitFeedback = async (req, res) => {
  try {
    const { productId, orderId, rating, comment, images } = req.body;
    const userId = req.user.id; // From auth middleware

    // Validate required fields
    if (!productId || !orderId || !rating) {
      return res.status(400).json({
        success: false,
        message: "Product ID, Order ID, and rating are required",
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Check if user has purchased the product and payment was successful
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      "paymentInfo.paymentStatus": "paid",
    });

    if (!order) {
      return res.status(403).json({
        success: false,
        message:
          "You can only review products you've purchased with successful payment",
      });
    }

    // Check if the product exists in the order
    const productInOrder = order.items.find(
      (item) => item.product.toString() === productId
    );

    if (!productInOrder) {
      return res.status(403).json({
        success: false,
        message: "This product was not found in your order",
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if feedback already exists for this product in this order
    const existingFeedback = await Feedback.findOne({
      user: userId,
      product: productId,
      order: orderId,
    });

    if (existingFeedback) {
      return res.status(409).json({
        success: false,
        message:
          "You have already submitted feedback for this product in this order",
      });
    }

    // Validate base64 images if provided
    if (images && Array.isArray(images)) {
      for (const image of images) {
        if (!image.startsWith("data:image/")) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid image format. Please provide valid base64 image strings",
          });
        }
      }
    }

    // Create feedback
    const feedback = new Feedback({
      user: userId,
      product: productId,
      order: orderId,
      rating,
      comment,
      images: images || [],
    });

    const savedFeedback = await feedback.save();

    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: savedFeedback,
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get feedback for a product
// @route   GET /api/feedback/product/:productId
// @access  Public
export const getProductFeedback = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      page = 1,
      limit = 10,
      rating,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = {
      product: productId,
      status: "approved",
    };

    if (rating) {
      filter.rating = parseInt(rating);
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    const feedback = await Feedback.find(filter)
      .populate({
        path: "user",
        select: "name email", // Only include public info
      })
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Feedback.countDocuments(filter);

    // Get rating statistics
    const stats = await Feedback.aggregate([
      {
        $match: {
          product: mongoose.Types.ObjectId(productId),
          status: "approved",
        },
      },
      {
        $group: {
          _id: "$product",
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          ratingCounts: {
            $push: "$rating",
          },
        },
      },
    ]);

    const ratingStats = stats[0] || {
      averageRating: 0,
      totalReviews: 0,
      ratingCounts: [],
    };

    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingStats.ratingCounts.forEach((rating) => {
      distribution[rating] = (distribution[rating] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        feedback,
        statistics: {
          averageRating: Math.round(ratingStats.averageRating * 10) / 10,
          totalReviews: ratingStats.totalReviews,
          distribution,
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalFeedback: total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get user's feedback
// @route   GET /api/feedback/user
// @access  Private
export const getUserFeedback = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 10 } = req.query;

    const feedback = await Feedback.find({ user: userId })
      .populate({
        path: "product",
        select: "productName image price",
      })
      .populate({
        path: "order",
        select: "orderNumber",
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Feedback.countDocuments({ user: userId });

    res.status(200).json({
      success: true,
      data: {
        feedback,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalFeedback: total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user feedback:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Update feedback
// @route   PUT /api/feedback/:id
// @access  Private
export const updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { rating, comment, images } = req.body;

    const feedback = await Feedback.findOne({ _id: id, user: userId });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Validate images if provided
    if (images && Array.isArray(images)) {
      for (const image of images) {
        if (!image.startsWith("data:image/")) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid image format. Please provide valid base64 image strings",
          });
        }
      }
    }

    // Update feedback
    if (rating) feedback.rating = rating;
    if (comment !== undefined) feedback.comment = comment;
    if (images !== undefined) feedback.images = images;

    const updatedFeedback = await feedback.save();

    res.status(200).json({
      success: true,
      message: "Feedback updated successfully",
      data: updatedFeedback,
    });
  } catch (error) {
    console.error("Error updating feedback:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Delete feedback
// @route   DELETE /api/feedback/:id
// @access  Private
export const deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const feedback = await Feedback.findOneAndDelete({ _id: id, user: userId });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Feedback deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting feedback:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getAllFeedbacks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      rating,
      productId,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
    } = req.query;

    // Build filter object
    const filter = {};

    // Filter by status
    if (status) {
      filter.status = status;
    }

    // Filter by rating
    if (rating) {
      filter.rating = parseInt(rating);
    }

    // Filter by product
    if (productId) {
      filter.product = productId;
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { comment: { $regex: search, $options: "i" } },
        { "user.name": { $regex: search, $options: "i" } },
        { "user.email": { $regex: search, $options: "i" } },
        { "product.productName": { $regex: search, $options: "i" } },
      ];
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get feedbacks with pagination and population
    const feedbacks = await Feedback.find(filter)
      .populate({
        path: "user",
        select: "name email avatar", // Include user details
      })
      .populate({
        path: "product",
        select: "productName images price category", // Include product details
      })
      .populate({
        path: "order",
        select: "orderNumber total", // Include order details
      })
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean(); // Use lean for better performance

    // Get total count for pagination
    const total = await Feedback.countDocuments(filter);

    // Get statistics for admin dashboard
    const stats = await Feedback.aggregate([
      {
        $group: {
          _id: null,
          totalFeedbacks: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          statusCounts: {
            $push: "$status",
          },
          ratingCounts: {
            $push: "$rating",
          },
        },
      },
    ]);

    // Calculate statistics
    const statistics = stats[0] || {
      totalFeedbacks: 0,
      averageRating: 0,
      statusCounts: [],
      ratingCounts: [],
    };

    // Calculate status distribution
    const statusDistribution = {
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    statistics.statusCounts.forEach((status) => {
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
    });

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    statistics.ratingCounts.forEach((rating) => {
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        feedbacks,
        statistics: {
          totalFeedbacks: statistics.totalFeedbacks,
          averageRating: Math.round(statistics.averageRating * 10) / 10 || 0,
          statusDistribution,
          ratingDistribution,
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalFeedbacks: total,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching all feedbacks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch feedbacks",
      error: error.message,
    });
  }
};

const feedbackController = {
  submitFeedback,
  getProductFeedback,
  getUserFeedback,
  updateFeedback,
  deleteFeedback,
  getAllFeedbacks,
};

export default feedbackController;
