import express from "express";
import {
  createContact,
  deleteContact,
  getAllContacts,
} from "../controllers/contactUsController.js";

const router = express.Router();

router.post("/", createContact);

router.get("/", getAllContacts);

router.delete("/:id", deleteContact);

export default router;
