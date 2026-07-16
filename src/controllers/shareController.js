const QRCode = require("qrcode");
const prisma = require("../config/prisma");

// Generates a QR code that encodes the user's Ore identity link
// (ore.me/username), per the "Long-Term Identity" vision — scanning
// it lets someone add the user without needing their phone number.
async function generateMyQr(req, res, next) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const identityUrl = `https://ore.me/${user.username}`;
    const qrDataUrl = await QRCode.toDataURL(identityUrl);

    res.json({ identityUrl, qrDataUrl });
  } catch (err) {
    next(err);
  }
}

module.exports = { generateMyQr };
