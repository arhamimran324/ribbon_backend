// routes/orderRoutes.js
import express from "express";
import {
  createOrder,
  confirmPayment,
  getOrder,
  getUserOrders,
  handleWebhook,
  getAllOrders,
  getAllPayments,
} from "../controllers/orderController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Webhook route (must be before body parser)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// Regular routes
router.get("/", getAllOrders);
router.get("/payments", getAllPayments);
router.post("/create", createOrder);
router.post("/confirm-payment", confirmPayment);
router.get("/:id", getOrder);
router.get("/user/orders", verifyToken(["admin"]), getUserOrders);

export default router;
