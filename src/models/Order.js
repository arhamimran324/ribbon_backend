// models/Order.js
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  image: {
    type: String,
    required: false,
  },
  // Flattened customization fields from your payload
  boxType: {
    type: String,
    enum: ["White Box", "Clear Box"],
    default: "White Box",
  },
  noteCard: {
    type: String,
    enum: ["None", "General", "Work", "Personal"],
    default: "None",
  },
  personalization: {
    to: String,
    from: String,
    message: String,
    personalized: {
      type: Boolean,
      default: false,
    },
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: false,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    items: [orderItemSchema],
    // Updated shippingAddress to accept string or object
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed, // Allows both string and object
      required: true,
    },
    paymentInfo: {
      paymentMethod: {
        type: String,
        enum: ["card", "paypal"],
        required: true,
      },
      paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded"],
        default: "pending",
      },
      paymentId: String,
    },
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      required: true,
    },
    shippingFee: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    shippingMethod: {
      type: String,
      enum: ["standard", "express"],
      default: "standard",
    },
    estimatedDelivery: Date,
  },
  {
    timestamps: true,
  }
);

orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 1000);
    this.orderNumber = `ORD-${timestamp}-${random}`;
  }
  next();
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ "paymentInfo.paymentStatus": 1 });

export default mongoose.model("Order", orderSchema);
