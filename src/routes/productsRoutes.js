import express from "express";
import productController from "../controllers/productController.js";
import { createRequire } from "module";
import { verifyToken } from "../middleware/authMiddleware.js";

const require = createRequire(import.meta.url);
const router = express.Router();

// Product routes
router.post("/", verifyToken(["admin"]), productController.createProduct);
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.get("/similar/:id", productController.getSimilarProducts);
router.put("/:id", verifyToken(["admin"]), productController.updateProduct);
router.delete("/:id", verifyToken(["admin"]), productController.deleteProduct);
router.patch(
  "/:id/status",
  verifyToken(["admin"]),
  productController.updateProductStatus
);

export default router;
