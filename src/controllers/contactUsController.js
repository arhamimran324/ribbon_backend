import mongoose from "mongoose";
import Contact from "../models/ContactUs.js";

// Create a new contact inquiry
export const createContact = async (req, res) => {
  try {
    const { name, email, subject, description, phoneNumber } = req.body;

    // Validate required fields
    if ((!name || !email || !subject || !description, !phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "All fields (name, email, subject, description) are required",
      });
    }

    // Create new contact inquiry
    const contact = new Contact({
      name,
      email,
      subject,
      description,
      phoneNumber,
    });

    const savedContact = await contact.save();

    res.status(201).json({
      success: true,
      message: "Contact inquiry submitted successfully",
      data: savedContact,
    });
  } catch (error) {
    console.error("Error creating contact inquiry:", error);

    // Handle duplicate key errors (unique constraint violations)
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists. Please use a different ${field}.`,
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get all contact inquiries
export const getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }); // Sort by latest first

    res.status(200).json({
      success: true,
      message: "Contact inquiries retrieved successfully",
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    console.error("Error fetching contact inquiries:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get single contact inquiry by ID
export const getContactById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID format",
      });
    }

    const contact = await Contact.findById(id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact inquiry not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact inquiry retrieved successfully",
      data: contact,
    });
  } catch (error) {
    console.error("Error fetching contact inquiry:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact ID format",
      });
    }

    // Find and delete the contact inquiry
    const deletedContact = await Contact.findByIdAndDelete(id);

    // Check if contact was found and deleted
    if (!deletedContact) {
      return res.status(404).json({
        success: false,
        message: "Contact inquiry not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contact inquiry deleted successfully",
      data: {
        id: deletedContact._id,
        name: deletedContact.name,
        email: deletedContact.email,
        subject: deletedContact.subject,
      },
    });
  } catch (error) {
    console.error("Error deleting contact inquiry:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const contactUsController = {
  createContact,
  getAllContacts,
  getContactById,
  deleteContact,
};

export default contactUsController;
