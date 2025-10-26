// controllers/orderController.js
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import stripe from "../config/stripe.js";
import mongoose from "mongoose";

// controllers/orderController.js
export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.orderStatus = status;
    if (paymentStatus) filter["paymentInfo.paymentStatus"] = paymentStatus;

    const orders = await Order.find(filter)
      .populate({
        path: "items.product",
        select: "productName price category status", // Only select these fields, exclude image
      })
      .populate({
        path: "user",
        select: "-password", // Exclude only password, include all other fields
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get orders",
      error: error.message,
    });
  }
};

// Create order and payment intent
export const createOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
      shippingMethod = "standard",
      subtotal,
      tax,
      discount = 0,
      shippingFee = 0,
      total,
      userId,
    } = req.body;

    console.log("Received order payload:", req.body);

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items are required and must be a non-empty array",
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    // Process items to extract customization data
    const processedItems = items.map((item) => {
      // Extract customization data from the item
      const { customization, ...itemData } = item;

      return {
        ...itemData,
        // Flatten customization into the item
        boxType: customization?.boxType || "White Box",
        noteCard: customization?.noteCard || "None",
        personalization: {
          to: customization?.personalization?.to || "",
          from: customization?.personalization?.from || "",
          message: customization?.personalization?.message || "",
          personalized: customization?.personalization?.personalized || false,
        },
      };
    });

    // Handle shipping address - can be string or object
    let processedShippingAddress;
    if (typeof shippingAddress === "string") {
      // If it's a string, store it as a simple address
      processedShippingAddress = shippingAddress;
    } else {
      // If it's an object, use the structured format
      processedShippingAddress = {
        firstName: shippingAddress.firstName || "",
        lastName: shippingAddress.lastName || "",
        email: shippingAddress.email || "",
        phone: shippingAddress.phone || "",
        address: shippingAddress.address || shippingAddress, // Fallback to string if address field doesn't exist
        city: shippingAddress.city || "",
        zipCode: shippingAddress.zipCode || "",
        country: shippingAddress.country || "United States",
      };
    }

    // Use provided totals or calculate them
    const finalSubtotal =
      subtotal ||
      processedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const finalTax = tax || finalSubtotal * 0.1;
    const finalShippingFee =
      shippingFee || (shippingMethod === "express" ? 12.99 : 3.99);
    const finalTotal =
      total || finalSubtotal + finalTax + finalShippingFee - discount;

    // Create order
    const order = new Order({
      items: processedItems,
      shippingAddress: processedShippingAddress,
      shippingMethod,
      subtotal: finalSubtotal,
      tax: finalTax,
      shippingFee: finalShippingFee,
      discount,
      total: finalTotal,
      user: new mongoose.Types.ObjectId(userId),
      paymentInfo: {
        paymentMethod: paymentMethod === "paypal" ? "paypal" : "card",
      },
    });

    await order.save();
    console.log("Order created successfully:", order._id);

    // Create Stripe payment intent for card payments
    if (paymentMethod !== "paypal") {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(finalTotal * 100), // Convert to cents
          currency: "usd",
          metadata: {
            orderId: order._id.toString(),
          },
          automatic_payment_methods: {
            enabled: true,
          },
        });

        // Create payment record
        const payment = new Payment({
          order: order._id,
          paymentIntentId: paymentIntent.id,
          amount: finalTotal,
          status: paymentIntent.status,
          paymentMethod: "card",
        });

        await payment.save();

        // Update order with payment ID
        order.paymentInfo.paymentId = paymentIntent.id;
        await order.save();

        return res.json({
          success: true,
          order: {
            _id: order._id,
            orderNumber: order.orderNumber,
            items: order.items,
            total: order.total,
            status: order.orderStatus,
          },
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        });
      } catch (stripeError) {
        console.error("Stripe error:", stripeError);

        // Update order status to reflect payment creation failure
        order.paymentInfo.paymentStatus = "failed";
        await order.save();

        return res.status(500).json({
          success: false,
          message: "Failed to create payment intent",
          error: stripeError.message,
        });
      }
    }

    // For PayPal payments
    res.json({
      success: true,
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        items: order.items,
        total: order.total,
        status: order.orderStatus,
      },
      message: "Order created successfully. Redirect to PayPal for payment.",
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// Confirm payment and update order
export const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;

    if (!paymentIntentId || !orderId) {
      return res.status(400).json({
        success: false,
        message: "Payment intent ID and order ID are required",
      });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      // Update payment record
      await Payment.findOneAndUpdate(
        { paymentIntentId },
        {
          status: paymentIntent.status,
          cardLast4:
            paymentIntent.charges?.data[0]?.payment_method_details?.card?.last4,
          cardBrand:
            paymentIntent.charges?.data[0]?.payment_method_details?.card?.brand,
          receiptUrl: paymentIntent.charges?.data[0]?.receipt_url,
        }
      );

      // Update order status
      const order = await Order.findByIdAndUpdate(
        orderId,
        {
          "paymentInfo.paymentStatus": "paid",
          orderStatus: "confirmed",
        },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Update product stock if needed (if you have stock management)
      try {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: -item.quantity },
          });
        }
      } catch (stockError) {
        console.error("Stock update error:", stockError);
        // Don't fail the payment confirmation if stock update fails
      }

      return res.json({
        success: true,
        order,
        message: "Payment confirmed successfully",
      });
    }

    res.status(400).json({
      success: false,
      message: "Payment not successful",
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error("Confirm payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
      error: error.message,
    });
  }
};

// Get order by ID
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product")
      .populate("user");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get order",
      error: error.message,
    });
  }
};

// Get user orders
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.userId })
      .populate("items.product")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get orders",
      error: error.message,
    });
  }
};

// Webhook for Stripe events
export const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        await handlePaymentSuccess(paymentIntent);
        break;
      case "payment_intent.payment_failed":
        const failedPayment = event.data.object;
        await handlePaymentFailure(failedPayment);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

// Helper functions for webhook
const handlePaymentSuccess = async (paymentIntent) => {
  try {
    const payment = await Payment.findOne({
      paymentIntentId: paymentIntent.id,
    });
    if (payment) {
      await Payment.findOneAndUpdate(
        { paymentIntentId: paymentIntent.id },
        {
          status: paymentIntent.status,
          cardLast4:
            paymentIntent.charges?.data[0]?.payment_method_details?.card?.last4,
          cardBrand:
            paymentIntent.charges?.data[0]?.payment_method_details?.card?.brand,
          receiptUrl: paymentIntent.charges?.data[0]?.receipt_url,
        }
      );

      await Order.findOneAndUpdate(
        { "paymentInfo.paymentId": paymentIntent.id },
        {
          "paymentInfo.paymentStatus": "paid",
          orderStatus: "confirmed",
        }
      );
    }
  } catch (error) {
    console.error("Webhook payment success handler error:", error);
  }
};

const handlePaymentFailure = async (paymentIntent) => {
  try {
    await Payment.findOneAndUpdate(
      { paymentIntentId: paymentIntent.id },
      { status: paymentIntent.status }
    );

    await Order.findOneAndUpdate(
      { "paymentInfo.paymentId": paymentIntent.id },
      {
        "paymentInfo.paymentStatus": "failed",
      }
    );
  } catch (error) {
    console.error("Webhook payment failure handler error:", error);
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentMethod,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
    } = req.query;

    // Build filter object
    const filter = {};

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Payment method filter
    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Search filter (by payment intent ID or order ID)
    if (search) {
      filter.$or = [
        { paymentIntentId: { $regex: search, $options: "i" } },
        { "orderDetails.orderNumber": { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get payments with order details populated
    const payments = await Payment.find(filter)
      .populate({
        path: "order",
        select: "orderNumber total user items",
        populate: {
          path: "user",
          select: "name email",
        },
      })
      .sort(sortConfig)
      .limit(limitNum)
      .skip(skip)
      .lean();

    // Transform the data for better client-side usage
    const transformedPayments = payments.map((payment) => ({
      _id: payment._id,
      paymentIntentId: payment.paymentIntentId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      cardLast4: payment.cardLast4,
      cardBrand: payment.cardBrand,
      receiptUrl: payment.receiptUrl,
      refunds: payment.refunds,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      order: payment.order
        ? {
            _id: payment.order._id,
            orderNumber: payment.order.orderNumber,
            total: payment.order.total,
            user: payment.order.user
              ? {
                  _id: payment.order.user._id,
                  name: payment.order.user.name,
                  email: payment.order.user.email,
                }
              : null,
            itemsCount: payment.order.items ? payment.order.items.length : 0,
          }
        : null,
    }));

    // Get total count for pagination
    const total = await Payment.countDocuments(filter);

    // Get summary statistics
    const stats = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          successfulAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "succeeded"] }, "$amount", 0],
            },
          },
          failedAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "failed"] }, "$amount", 0],
            },
          },
          totalCount: { $sum: 1 },
          successfulCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0],
            },
          },
          failedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "failed"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const summary = stats[0] || {
      totalAmount: 0,
      successfulAmount: 0,
      failedAmount: 0,
      totalCount: 0,
      successfulCount: 0,
      failedCount: 0,
    };

    res.json({
      success: true,
      payments: transformedPayments,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
      },
      summary: {
        totalAmount: summary.totalAmount,
        successfulAmount: summary.successfulAmount,
        failedAmount: summary.failedAmount,
        totalCount: summary.totalCount,
        successfulCount: summary.successfulCount,
        failedCount: summary.failedCount,
      },
      filters: {
        status,
        paymentMethod,
        startDate,
        endDate,
        search,
      },
    });
  } catch (error) {
    console.error("Get all payments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payments",
      error: error.message,
    });
  }
};

const orderController = {
  handleWebhook,
  createOrder,
  confirmPayment,
  getOrder,
  getUserOrders,
  getAllOrders,
  getAllPayments,
};

export default orderController;
