import express from "express";
import faqController from "../controllers/faqController.js";
import { createRequire } from "module";
import { verifyToken } from "../middleware/authMiddleware.js";

const require = createRequire(import.meta.url);
const router = express.Router();

// Product routes
router.post("/", verifyToken(["admin"]), faqController.createFAQ);
router.get("/", faqController.getAllFAQs);
router.get("/:id", faqController.getFAQById);
router.put("/:id", verifyToken(["admin"]), faqController.updateFAQ);
router.delete("/:id", verifyToken(["admin"]), faqController.deleteFAQ);
router.patch(
  "/:id/status",
  verifyToken(["admin"]),
  faqController.updateFAQStatus
);

export default router;
