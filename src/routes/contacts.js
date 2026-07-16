const express = require("express");
const {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  syncContacts,
  findDuplicates,
  addTimelineEvent,
} = require("../controllers/contactsController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", listContacts);
router.post("/", createContact);
router.post("/sync", syncContacts);
router.get("/duplicates", findDuplicates);
router.get("/:id", getContact);
router.patch("/:id", updateContact);
router.delete("/:id", deleteContact);
router.post("/:id/timeline", addTimelineEvent);

module.exports = router;
