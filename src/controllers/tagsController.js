const { z } = require("zod");
const prisma = require("../config/prisma");

const tagSchema = z.object({
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

async function listTags(req, res, next) {
  try {
    const tags = await prisma.tag.findMany({ where: { ownerId: req.userId } });
    res.json({ tags });
  } catch (err) {
    next(err);
  }
}

async function createTag(req, res, next) {
  try {
    const data = tagSchema.parse(req.body);
    const tag = await prisma.tag.create({
      data: { ownerId: req.userId, name: data.name, color: data.color },
    });
    res.status(201).json({ tag });
  } catch (err) {
    next(err);
  }
}

async function deleteTag(req, res, next) {
  try {
    const existing = await prisma.tag.findFirst({
      where: { id: req.params.id, ownerId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: "Tag not found" });

    await prisma.tag.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

async function tagContact(req, res, next) {
  try {
    const { contactId, tagId } = req.params;

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, ownerId: req.userId },
    });
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const tag = await prisma.tag.findFirst({ where: { id: tagId, ownerId: req.userId } });
    if (!tag) return res.status(404).json({ error: "Tag not found" });

    await prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      create: { contactId, tagId },
      update: {},
    });

    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function untagContact(req, res, next) {
  try {
    const { contactId, tagId } = req.params;
    await prisma.contactTag.deleteMany({ where: { contactId, tagId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listTags, createTag, deleteTag, tagContact, untagContact };
