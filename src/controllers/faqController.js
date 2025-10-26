import mongoose from "mongoose";
import FAQ from "../models/FAQ.js";

export const createFAQ = async (req, res) => {
  try {
    const { title, description, isActive } = req.body;

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: title and description",
      });
    }

    // Check if FAQ with same description already exists (unique constraint)
    const existingFAQ = await FAQ.findOne({ description });
    if (existingFAQ) {
      return res.status(409).json({
        success: false,
        message: "A FAQ with this description already exists",
      });
    }

    // Create new FAQ
    const faq = new FAQ({
      title,
      description,
      isActive: isActive !== undefined ? isActive : true,
    });

    const savedFAQ = await faq.save();

    res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      data: savedFAQ,
    });
  } catch (error) {
    console.error("Error creating FAQ:", error);

    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A FAQ with this description already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getFAQById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid FAQ ID format",
      });
    }

    const faq = await FAQ.findById(id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "FAQ retrieved successfully",
      data: faq,
    });
  } catch (error) {
    console.error("Error retrieving FAQ:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const updateFAQ = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, isActive } = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid FAQ ID format",
      });
    }

    // Check if FAQ exists
    const existingFAQ = await FAQ.findById(id);
    if (!existingFAQ) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    // Check if description is being updated and if it would cause a duplicate
    if (description && description !== existingFAQ.description) {
      const duplicateFAQ = await FAQ.findOne({ description });
      if (duplicateFAQ) {
        return res.status(409).json({
          success: false,
          message: "A FAQ with this description already exists",
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedFAQ = await FAQ.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      data: updatedFAQ,
    });
  } catch (error) {
    console.error("Error updating FAQ:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A FAQ with this description already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const updateFAQStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid FAQ ID format",
      });
    }

    // Validate required field
    if (isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: "Please provide isActive field",
      });
    }

    // Check if FAQ exists
    const existingFAQ = await FAQ.findById(id);
    if (!existingFAQ) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    const updatedFAQ = await FAQ.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: `FAQ ${isActive ? "activated" : "deactivated"} successfully`,
      data: updatedFAQ,
    });
  } catch (error) {
    console.error("Error updating FAQ status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const deleteFAQ = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid FAQ ID format",
      });
    }

    // Check if FAQ exists
    const existingFAQ = await FAQ.findById(id);
    if (!existingFAQ) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    await FAQ.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting FAQ:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getAllFAQs = async (req, res) => {
  try {
    const { isActive } = req.query;

    let filter = {};

    // Filter by active status if provided
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const faqs = await FAQ.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "FAQs retrieved successfully",
      data: faqs,
      count: faqs.length,
    });
  } catch (error) {
    console.error("Error retrieving FAQs:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const faqController = {
  createFAQ,
  getAllFAQs,
  getFAQById,
  updateFAQ,
  deleteFAQ,
  updateFAQStatus,
};

export default faqController;
