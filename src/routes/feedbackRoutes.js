// routes/feedbackRoutes.js
import express from "express";
import feedbackController from "../controllers/feedbackController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", verifyToken(["user"]), feedbackController.submitFeedback);
router.get("/", verifyToken(["admin"]), feedbackController.getAllFeedbacks);
router.get("/user", verifyToken(["admin"]), feedbackController.getUserFeedback);
router.put("/:id", feedbackController.updateFeedback);
router.delete("/:id", feedbackController.deleteFeedback);

router.get("/product/:productId", feedbackController.getProductFeedback);

export default router;
