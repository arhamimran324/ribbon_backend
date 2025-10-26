import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: 1000,
    },
    images: [
      {
        type: String, // base64 images
      },
    ],
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate feedback for same product in same order
feedbackSchema.index({ user: 1, product: 1, order: 1 }, { unique: true });

// Update product rating stats when feedback is saved
feedbackSchema.post("save", async function () {
  const Feedback = mongoose.model("Feedback");

  const stats = await Feedback.aggregate([
    {
      $match: {
        product: this.product,
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$product",
        averageRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
        ratingDistribution: {
          $push: "$rating",
        },
      },
    },
  ]);

  if (stats.length > 0) {
    const Product = mongoose.model("Product");
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    stats[0].ratingDistribution.forEach((rating) => {
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    });

    await Product.findByIdAndUpdate(this.product, {
      rating: {
        average: Math.round(stats[0].averageRating * 10) / 10,
        count: stats[0].ratingCount,
        distribution: ratingDistribution,
      },
    });
  }
});

export default mongoose.model("Feedback", feedbackSchema);
