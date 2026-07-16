const express = require("express");
const { generateMyQr } = require("../controllers/shareController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/qr", requireAuth, generateMyQr);

module.exports = router;
