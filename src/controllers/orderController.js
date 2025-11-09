// controllers/orderController.js
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import stripe from "../config/stripe.js";
import mongoose from "mongoose";

// Get all orders with built box support
export const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      orderType,
    } = req.query;

    const filter = {};
    if (status) filter.orderStatus = status;
    if (paymentStatus) filter["paymentInfo.paymentStatus"] = paymentStatus;
    if (orderType) filter.orderType = orderType;

    const orders = await Order.find(filter)
      .populate({
        path: "items.product",
        select: "productName price category status image discount", // Include all necessary fields
      })
      .populate({
        path: "user",
        select: "-password",
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
      builtBox,
      shippingAddress,
      paymentMethod,
      shippingMethod = "standard",
      subtotal,
      tax,
      discount = 0,
      shippingFee = 0,
      total,
      userId,
      orderType = "simple",
    } = req.body;

    console.log("Received order payload:", req.body);

    // Validate based on order type
    if (orderType === "simple") {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "Items are required and must be a non-empty array for simple orders",
        });
      }
    } else if (orderType === "built-box") {
      if (
        !builtBox ||
        !builtBox.selectedItems ||
        !Array.isArray(builtBox.selectedItems) ||
        builtBox.selectedItems.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Built box data with selected items is required",
        });
      }
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    let processedItems = [];
    let finalSubtotal = 0;
    let orderData = {};

    // Process based on order type
    if (orderType === "simple") {
      // Validate and process simple product order items
      for (const item of items) {
        if (!item.product || !mongoose.Types.ObjectId.isValid(item.product)) {
          return res.status(400).json({
            success: false,
            message: `Invalid product ID: ${item.product}`,
          });
        }

        // Verify product exists
        const product = await Product.findById(item.product);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Product not found: ${item.product}`,
          });
        }

        processedItems.push({
          product: item.product,
          quantity: item.quantity || 1,
          customization: item.customization || {},
        });
      }

      // Calculate subtotal from actual product prices
      const products = await Product.find({
        _id: { $in: processedItems.map((item) => item.product) },
      });

      finalSubtotal = processedItems.reduce((sum, item) => {
        const product = products.find(
          (p) => p._id.toString() === item.product.toString()
        );
        return sum + (product?.price || 0) * item.quantity;
      }, 0);

      orderData = {
        orderType: "simple",
        items: processedItems,
      };
    } else if (orderType === "built-box") {
      // Validate and process built box order items
      for (const item of builtBox.selectedItems) {
        if (!item.id || !mongoose.Types.ObjectId.isValid(item.id)) {
          return res.status(400).json({
            success: false,
            message: `Invalid product ID in built box: ${item.id}`,
          });
        }

        // Verify product exists
        const product = await Product.findById(item.id);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Product not found in built box: ${item.id}`,
          });
        }

        processedItems.push({
          product: item.id,
          quantity: item.quantity || 1,
          customization: item.customization || {},
        });
      }

      // Calculate subtotal from actual product prices
      const products = await Product.find({
        _id: { $in: processedItems.map((item) => item.product) },
      });

      finalSubtotal = processedItems.reduce((sum, item) => {
        const product = products.find(
          (p) => p._id.toString() === item.product.toString()
        );
        const price =
          product?.discount > 0
            ? product.price - (product.price * product.discount) / 100
            : product?.price || 0;
        return sum + price * item.quantity;
      }, 0);

      orderData = {
        orderType: "built-box",
        builtBox: {
          boxType: builtBox.boxType || "custom",
          boxSize: builtBox.boxSize,
          boxLimit: builtBox.boxLimit || 0,
          cardDetails: builtBox.cardDetails || {},
          personalization: builtBox.personalization || {},
        },
        items: processedItems, // Store items in the main items array for built box too
      };
    }

    // Handle shipping address
    let processedShippingAddress;
    if (typeof shippingAddress === "string") {
      processedShippingAddress = shippingAddress;
    } else {
      processedShippingAddress = {
        firstName: shippingAddress.firstName || "",
        lastName: shippingAddress.lastName || "",
        email: shippingAddress.email || "",
        phone: shippingAddress.phone || "",
        address: shippingAddress.address || shippingAddress,
        city: shippingAddress.city || "",
        zipCode: shippingAddress.zipCode || "",
        country: shippingAddress.country || "United States",
      };
    }

    // Calculate totals
    const finalTax = tax || finalSubtotal * 0.1;
    const finalShippingFee =
      shippingFee || (shippingMethod === "express" ? 12.99 : 3.99);
    const finalTotal =
      total || finalSubtotal + finalTax + finalShippingFee - discount;

    // Create order
    const order = new Order({
      ...orderData,
      shippingAddress: processedShippingAddress,
      shippingMethod,
      subtotal: finalSubtotal,
      tax: finalTax,
      shippingFee: finalShippingFee,
      discount,
      total: finalTotal,
      user: userId ? new mongoose.Types.ObjectId(userId) : undefined,
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
          amount: Math.round(finalTotal * 100),
          currency: "usd",
          metadata: {
            orderId: order._id.toString(),
            orderType: orderType,
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

        // Populate the order with product details for response
        const populatedOrder = await Order.findById(order._id).populate(
          "items.product",
          "productName price category status image discount"
        );

        return res.json({
          success: true,
          order: {
            _id: populatedOrder._id,
            orderNumber: populatedOrder.orderNumber,
            orderType: populatedOrder.orderType,
            items: populatedOrder.items,
            builtBox: populatedOrder.builtBox,
            total: populatedOrder.total,
            status: populatedOrder.orderStatus,
          },
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        });
      } catch (stripeError) {
        console.error("Stripe error:", stripeError);

        order.paymentInfo.paymentStatus = "failed";
        await order.save();

        return res.status(500).json({
          success: false,
          message: "Failed to create payment intent",
          error: stripeError.message,
        });
      }
    }

    // For PayPal payments - populate order for response
    const populatedOrder = await Order.findById(order._id).populate(
      "items.product",
      "productName price category status image discount"
    );

    res.json({
      success: true,
      order: {
        _id: populatedOrder._id,
        orderNumber: populatedOrder.orderNumber,
        orderType: populatedOrder.orderType,
        items: populatedOrder.items,
        builtBox: populatedOrder.builtBox,
        total: populatedOrder.total,
        status: populatedOrder.orderStatus,
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

// Create built box order (convenience function)
export const createBuiltBoxOrder = async (req, res) => {
  try {
    const builtBoxData = req.body;

    const orderPayload = {
      ...builtBoxData,
      orderType: "built-box",
      builtBox: builtBoxData,
      items: [], // Will be processed in createOrder
    };

    return createOrder({ body: orderPayload }, res);
  } catch (error) {
    console.error("Create built box order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create built box order",
      error: error.message,
    });
  }
};

// Get order by ID with product population
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({
        path: "items.product",
        select: "productName price category status image discount",
      })
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

// Get user orders with product population
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.userId })
      .populate({
        path: "items.product",
        select: "productName price category status image discount",
      })
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
      ).populate({
        path: "items.product",
        select: "productName price category status image discount",
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      // Update product stock for all order types
      try {
        for (const item of order.items) {
          if (item.product && item.product._id) {
            await Product.findByIdAndUpdate(item.product._id, {
              $inc: { stock: -item.quantity },
            });
          }
        }
      } catch (stockError) {
        console.error("Stock update error:", stockError);
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
// Webhook for Stripe events (with built box support)
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

// Get all payments (with built box support)
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
      orderType,
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
        select: "orderNumber total user items builtBox orderType",
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
            orderType: payment.order.orderType,
            total: payment.order.total,
            user: payment.order.user
              ? {
                  _id: payment.order.user._id,
                  name: payment.order.user.name,
                  email: payment.order.user.email,
                }
              : null,
            itemsCount: payment.order.items ? payment.order.items.length : 0,
            builtBox: payment.order.builtBox,
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
        orderType,
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
  createBuiltBoxOrder, // Add the new function
  confirmPayment,
  getOrder,
  getUserOrders,
  getAllOrders,
  getAllPayments,
};

export default orderController;
