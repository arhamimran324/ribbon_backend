import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js"; 
import config from "../../config/config.js";

const createAdmin = async () => {
  try {
    
    await mongoose.connect(config.MONGO_URI);
    console.log("✅ MongoDB connected");

    const email = "admin@test.com"; 
    const password = "admin@123456";    
    const first_name = "Admin";
    const last_name = "Admin";

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      console.log("⚠️ Admin already exists with this email.");
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const admin = await User.create({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      role: "admin",
    });

    console.log("✅ Admin created successfully:", admin);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  }
};

createAdmin();
