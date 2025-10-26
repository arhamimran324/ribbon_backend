// models/Payment.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    paymentIntentId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "usd",
    },
    status: {
      type: String,
      enum: [
        "requires_payment_method",
        "requires_confirmation",
        "processing",
        "requires_action",
        "succeeded",
        "canceled",
        "failed",
      ],
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    cardLast4: String,
    cardBrand: String,
    receiptUrl: String,
    refunds: [
      {
        refundId: String,
        amount: Number,
        reason: String,
        status: String,
        createdAt: Date,
      },
    ],
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ paymentIntentId: 1 });
paymentSchema.index({ order: 1 });
paymentSchema.index({ status: 1 });

export default mongoose.model("Payment", paymentSchema);
