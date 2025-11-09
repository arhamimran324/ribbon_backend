// models/Order.js
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true, // Now required for both simple and built box orders
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  // Only store customization data, not product data
  customization: {
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
  },
});

// Built Box specific schema
const builtBoxSchema = new mongoose.Schema({
  boxType: {
    type: String,
    required: true,
    enum: ["regular", "big", "custom"],
  },
  boxSize: {
    type: String,
    required: true,
    enum: ["Regular", "Big"],
  },
  boxLimit: {
    type: Number,
    required: true,
  },
  cardDetails: {
    cardId: String,
    cardName: String,
    to: String,
    from: String,
    message: String,
    leaveBlank: {
      type: Boolean,
      default: false,
    },
    noNote: {
      type: Boolean,
      default: false,
    },
  },
  personalization: {
    option: {
      type: String,
      enum: ["yes", "no"],
      default: "no",
    },
    message: String,
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
    orderType: {
      type: String,
      enum: ["simple", "built-box"],
      default: "simple",
    },
    // For simple product orders
    items: [orderItemSchema],
    // For built box orders
    builtBox: builtBoxSchema,
    // Updated shippingAddress to accept string or object
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
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
orderSchema.index({ orderType: 1 });

export default mongoose.model("Order", orderSchema);
