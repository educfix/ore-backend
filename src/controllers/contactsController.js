const { z } = require("zod");
const prisma = require("../config/prisma");
const { normalizePhone } = require("../utils/phone");

const contactSchema = z.object({
  name: z.string().min(1),
  phoneNumbers: z.array(z.string()).default([]),
  emails: z.array(z.string().email()).default([]),
  avatarUrl: z.string().url().optional(),
  howWeMet: z.string().optional(),
  relationshipType: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

// ── List + search ────────────────────────────────
async function listContacts(req, res, next) {
  try {
    const { q, tag } = req.query;

    const contacts = await prisma.contact.findMany({
      where: {
        ownerId: req.userId,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phoneNumbers: { has: q } },
                { emails: { has: q } },
              ],
            }
          : {}),
        ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
      },
      include: { tags: { include: { tag: true } } },
      orderBy: { name: "asc" },
    });

    res.json({ contacts });
  } catch (err) {
    next(err);
  }
}

// ── Get one, including timeline ──────────────────
async function getContact(req, res, next) {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
      include: {
        tags: { include: { tag: true } },
        timelineEvents: { orderBy: { createdAt: "desc" } },
        reminders: { orderBy: { dueAt: "asc" } },
      },
    });

    if (!contact) return res.status(404).json({ error: "Contact not found" });
    res.json({ contact });
  } catch (err) {
    next(err);
  }
}

// ── Create ────────────────────────────────────────
async function createContact(req, res, next) {
  try {
    const data = contactSchema.parse(req.body);
    const primaryPhone = data.phoneNumbers[0];

    const contact = await prisma.contact.create({
      data: {
        ownerId: req.userId,
        name: data.name,
        phoneNumbers: data.phoneNumbers,
        emails: data.emails,
        avatarUrl: data.avatarUrl,
        howWeMet: data.howWeMet,
        relationshipType: data.relationshipType,
        normalizedPhone: normalizePhone(primaryPhone),
        source: "manual",
        tags: data.tagIds
          ? { create: data.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });

    res.status(201).json({ contact });
  } catch (err) {
    next(err);
  }
}

// ── Update ────────────────────────────────────────
async function updateContact(req, res, next) {
  try {
    const data = contactSchema.partial().parse(req.body);

    const existing = await prisma.contact.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: "Contact not found" });

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        ...data,
        normalizedPhone: data.phoneNumbers
          ? normalizePhone(data.phoneNumbers[0])
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });

    res.json({ contact });
  } catch (err) {
    next(err);
  }
}

// ── Delete ────────────────────────────────────────
async function deleteContact(req, res, next) {
  try {
    const existing = await prisma.contact.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: "Contact not found" });

    await prisma.contact.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ── Bulk sync from phone contacts ────────────────
// Accepts an array of { name, phoneNumbers, emails } from the device's
// native contact book. Creates new contacts and flags likely duplicates
// instead of silently merging them.
async function syncContacts(req, res, next) {
  try {
    const syncSchema = z.object({
      contacts: z.array(
        z.object({
          name: z.string(),
          phoneNumbers: z.array(z.string()).default([]),
          emails: z.array(z.string()).default([]),
        })
      ),
    });
    const { contacts: incoming } = syncSchema.parse(req.body);

    const existing = await prisma.contact.findMany({
      where: { ownerId: req.userId },
      select: { id: true, normalizedPhone: true },
    });
    const existingPhones = new Set(existing.map((c) => c.normalizedPhone).filter(Boolean));

    const toCreate = [];
    const duplicates = [];

    for (const c of incoming) {
      const normalized = normalizePhone(c.phoneNumbers[0]);
      if (normalized && existingPhones.has(normalized)) {
        duplicates.push({ name: c.name, phone: c.phoneNumbers[0] });
        continue;
      }
      toCreate.push({
        ownerId: req.userId,
        name: c.name,
        phoneNumbers: c.phoneNumbers,
        emails: c.emails,
        normalizedPhone: normalized,
        source: "phone_sync",
      });
      if (normalized) existingPhones.add(normalized);
    }

    if (toCreate.length > 0) {
      await prisma.contact.createMany({ data: toCreate });
    }

    res.json({
      created: toCreate.length,
      skippedDuplicates: duplicates.length,
      duplicates,
    });
  } catch (err) {
    next(err);
  }
}

// ── Duplicate detection (existing Ore contacts) ──
async function findDuplicates(req, res, next) {
  try {
    const contacts = await prisma.contact.findMany({
      where: { ownerId: req.userId, normalizedPhone: { not: null } },
      select: { id: true, name: true, normalizedPhone: true, avatarUrl: true },
    });

    const groups = {};
    for (const c of contacts) {
      if (!groups[c.normalizedPhone]) groups[c.normalizedPhone] = [];
      groups[c.normalizedPhone].push(c);
    }

    const duplicateGroups = Object.values(groups).filter((g) => g.length > 1);
    res.json({ duplicateGroups });
  } catch (err) {
    next(err);
  }
}

// ── Timeline events ───────────────────────────────
async function addTimelineEvent(req, res, next) {
  try {
    const schema = z.object({
      type: z.enum(["note", "call", "message", "payment", "meeting", "introduction"]),
      content: z.string().min(1),
    });
    const data = schema.parse(req.body);

    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
    });
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const event = await prisma.timelineEvent.create({
      data: { contactId: req.params.id, type: data.type, content: data.content },
    });

    res.status(201).json({ event });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  syncContacts,
  findDuplicates,
  addTimelineEvent,
};
