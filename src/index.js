require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const contactsRoutes = require("./routes/contacts");
const tagsRoutes = require("./routes/tags");
const shareRoutes = require("./routes/share");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(morgan("dev"));
app.use(express.json());

// Basic rate limiting on auth endpoints to slow down credential stuffing
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use("/api/auth", authLimiter, authRoutes);

app.use("/api/contacts", contactsRoutes);
app.use("/api/tags", tagsRoutes);
app.use("/api/share", shareRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Ore API listening on port ${PORT}`);
});
