const express = require("express");
const {
  listTags,
  createTag,
  deleteTag,
  tagContact,
  untagContact,
} = require("../controllers/tagsController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", listTags);
router.post("/", createTag);
router.delete("/:id", deleteTag);
router.post("/:tagId/contacts/:contactId", tagContact);
router.delete("/:tagId/contacts/:contactId", untagContact);

module.exports = router;
