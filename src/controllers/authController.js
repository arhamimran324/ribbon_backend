import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import config from "../config/config.js";
import mongoose from "mongoose";
import Order from "../models/Order.js";

export const registerUser = async (req, res) => {
  try {
    const { name, email, phone, address, password, confirmPassword, role } =
      req.body;

    if (!name || !email || !password || !confirmPassword || !role || !address) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: role,
      address,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: user.address,
      },
    });
  } catch (error) {
    console.error("Error in registerUser:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password" });

    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: "Your account has been deactivated. Contact admin." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      config.JWT_ACCESS_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      status: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: user.address,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Error in loginUser:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    // Build search filter
    const searchFilter = {
      role: "user",
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    };

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get users with last order date using aggregation
    const users = await User.aggregate([
      { $match: searchFilter },
      // Lookup to get the most recent order for each user
      {
        $lookup: {
          from: "orders", // assuming your orders collection name is "orders"
          localField: "_id",
          foreignField: "user",
          as: "orders",
        },
      },
      // Add fields for last order date and order count
      {
        $addFields: {
          orderCount: { $size: "$orders" },
          lastOrderDate: {
            $cond: {
              if: { $gt: [{ $size: "$orders" }, 0] },
              then: { $max: "$orders.createdAt" },
              else: null,
            },
          },
        },
      },
      // Project only the fields we need
      {
        $project: {
          password: 0,
          __v: 0,
          orders: 0, // exclude the full orders array
        },
      },
      // Sort by last order date (users with orders first), then by creation date
      {
        $sort: {
          lastOrderDate: -1,
          createdAt: -1,
        },
      },
      // Pagination
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]);

    // Get total count for pagination
    const total = await User.countDocuments(searchFilter);

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      count: users.length,
      total,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        itemsPerPage: parseInt(limit),
      },
      users: users.map((user) => ({
        ...user,
        lastOrderDate: user.lastOrderDate || null,
        hasOrders: user.orderCount > 0,
        orderCount: user.orderCount,
      })),
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getUserDetailsByID = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    console.log({ userId });

    // Get user details with order statistics using aggregation
    const userDetails = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId),
          role: "user",
        },
      },
      // Lookup to get all orders for this user
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "user",
          as: "orders",
        },
      },
      // Add order statistics
      {
        $addFields: {
          orderCount: { $size: "$orders" },
          totalSpent: {
            $sum: "$orders.total",
          },
          lastOrderDate: {
            $cond: {
              if: { $gt: [{ $size: "$orders" }, 0] },
              then: { $max: "$orders.createdAt" },
              else: null,
            },
          },
          averageOrderValue: {
            $cond: {
              if: { $gt: [{ $size: "$orders" }, 0] },
              then: {
                $divide: [{ $sum: "$orders.total" }, { $size: "$orders" }],
              },
              else: 0,
            },
          },
        },
      },
      // Project the fields we need
      {
        $project: {
          password: 0,
          __v: 0,
          "orders.items": 0, // Exclude detailed items for now
          "orders.user": 0,
        },
      },
    ]);

    if (!userDetails || userDetails.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = userDetails[0];

    // Get detailed orders with pagination
    const { page = 1, limit = 10, status } = req.query;
    const orderFilter = { user: new mongoose.Types.ObjectId(userId) };

    if (status) {
      orderFilter.orderStatus = status;
    }

    const orders = await Order.find(orderFilter)
      .populate({
        path: "items.product",
        select: "productName price category image",
      })
      .select("-__v")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const totalOrders = await Order.countDocuments(orderFilter);

    // Transform orders data for better client-side usage
    const transformedOrders = orders.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      items: order.items.map((item) => ({
        _id: item._id,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        boxType: item.boxType,
        noteCard: item.noteCard,
        personalization: item.personalization,
        product: item.product
          ? {
              _id: item.product._id,
              productName: item.product.productName,
              category: item.product.category,
              price: item.product.price,
              image: item.product.image,
            }
          : null,
      })),
      shippingAddress: order.shippingAddress,
      orderStatus: order.orderStatus,
      subtotal: order.subtotal,
      tax: order.tax,
      shippingFee: order.shippingFee,
      discount: order.discount,
      total: order.total,
      shippingMethod: order.shippingMethod,
      paymentInfo: order.paymentInfo,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    // Get order status distribution
    const statusDistribution = await Order.aggregate([
      {
        $match: { user: new mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$total" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      message: "User details fetched successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isActive: user.isActive,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // Order statistics
        orderStats: {
          totalOrders: user.orderCount,
          totalSpent: user.totalSpent || 0,
          averageOrderValue: user.averageOrderValue || 0,
          lastOrderDate: user.lastOrderDate,
          statusDistribution: statusDistribution.reduce((acc, curr) => {
            acc[curr._id] = {
              count: curr.count,
              totalAmount: curr.totalAmount,
            };
            return acc;
          }, {}),
        },
      },
      orders: {
        data: transformedOrders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalOrders / limit),
          totalOrders,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Error in getUserDetailsByID:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const otpStorage = new Map();

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTPEmail = async (email, otp) => {
  try {
    console.log(`Sending OTP to ${email}: ${otp}`);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: config.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      html: `
        <h2>Password Reset Request</h2>
        <p>Your OTP for password reset is: <strong>${otp}</strong></p>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return true;
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return false;
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If the email exists in our system, an OTP has been sent",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact admin.",
      });
    }

    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    otpStorage.set(email, {
      otp,
      expiry: otpExpiry,
      attempts: 0,
    });

    const emailSent = await sendOTPEmail(email, otp);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email",
      email: email,
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred",
    });
  }
};

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const storedOTPData = otpStorage.get(email);
    if (!storedOTPData) {
      return res.status(400).json({
        success: false,
        message: "OTP not found or expired. Please request a new OTP.",
      });
    }

    if (Date.now() > storedOTPData.expiry) {
      otpStorage.delete(email);
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    if (storedOTPData.attempts >= 3) {
      otpStorage.delete(email);
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    if (storedOTPData.otp !== otp) {
      storedOTPData.attempts += 1;
      otpStorage.set(email, storedOTPData);

      const remainingAttempts = 3 - storedOTPData.attempts;

      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
      });
    }

    const resetToken = jwt.sign(
      { email, purpose: "password_reset" },
      config.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    otpStorage.delete(email);

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("Error in verifyOTP:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token, new password, and confirm password are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, config.JWT_ACCESS_SECRET);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    if (decoded.purpose !== "password_reset") {
      return res.status(400).json({
        success: false,
        message: "Invalid reset token",
      });
    }

    const { email } = decoded;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact admin.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred",
    });
  }
};
