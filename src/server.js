import express from "express";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import "express-async-errors";
import cors from "cors";
import connectDB from "./config/db.js";
import config from "./config/config.js";
import http from "http";

import routes from "./routes/index.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productsRoutes.js";
import faqRoutes from "./routes/faqRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import contactUsRoutes from "./routes/contactUsRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware setup
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use("/uploads", express.static("uploads"));

app.use("/api", routes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/faq", faqRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/contact-us", contactUsRoutes);
app.use("/api/feedback", feedbackRoutes);

const PORT = config.PORT || 5000;
const NODE_ENV = config.NODE_ENV || "development";

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(
      `🚀 Server running in ${NODE_ENV} mode at http://localhost:${PORT}`
    );
  });
});
