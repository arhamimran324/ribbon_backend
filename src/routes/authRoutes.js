import express from "express";
import {
  registerUser,
  loginUser,
  forgotPassword,
  verifyOTP,
  resetPassword,
  getAllUsers,
  getUserDetailsByID,
} from "../controllers/authController.js";
import { createRequire } from "module";
import { verifyToken } from "../middleware/authMiddleware.js";

const require = createRequire(import.meta.url);
const router = express.Router();

router.post("/register", registerUser);
router.get("/users", verifyToken(["admin"]), getAllUsers);
router.get("/users/:userId", verifyToken(["admin"]), getUserDetailsByID);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);

export default router;
