const express = require('express');
const router = express.Router();

const { getCollection, ObjectId } = require('../lib/db');
const requireAuth = require('../middleware/auth');

const categories = new Set(['Fiction', 'Science', 'History', 'Kids', 'Others']);
const stringFields = ['title', 'author', 'image', 'description'];

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateBook(input, partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['Request body must be a JSON object.'];
  }

  const errors = [];
  for (const field of stringFields) {
    if ((!partial || input[field] !== undefined) && typeof input[field] !== 'string') {
      errors.push(`${field} must be a string.`);
    } else if (typeof input[field] === 'string') {
      const value = input[field].trim();
      const max = field === 'description' ? 2000 : field === 'image' ? 2048 : 140;
      if (!value) errors.push(`${field} is required.`);
      if (value.length > max) errors.push(`${field} must be ${max} characters or fewer.`);
      if (field === 'image' && value && !isHttpUrl(value)) {
        errors.push('image must be an HTTP or HTTPS URL.');
      }
    }
  }

  if ((!partial || input.category !== undefined) && !categories.has(input.category)) {
    errors.push('Choose a valid book category.');
  }

  if (!partial || input.totalCopies !== undefined) {
    const copies = Number(input.totalCopies);
    if (!Number.isInteger(copies) || copies < 0 || (!partial && copies < 1)) {
      errors.push('totalCopies must be a whole number greater than zero.');
    }
  }
  return errors;
}

router.get('/', async (req, res, next) => {
  try {
    const books = await getCollection('books');
    const limit = req.query.limit === undefined ? 0 : Number(req.query.limit);
    const sort = req.query.sort || 'newest';
    const category = req.query.category;
    const available = req.query.available;
    if (req.query.limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
      return res.status(400).json({ message: 'limit must be a whole number between 1 and 100.' });
    }
    if (sort !== 'newest' && sort !== 'mostBorrowed') {
      return res.status(400).json({ message: 'sort must be newest or mostBorrowed.' });
    }
    if (category !== undefined && !categories.has(category)) {
      return res.status(400).json({ message: 'Choose a valid book category.' });
    }
    if (available !== undefined && available !== 'true' && available !== 'false') {
      return res.status(400).json({ message: 'available must be true or false.' });
    }

    const filter = {};
    if (category !== undefined) filter.category = category;
    if (available === 'true') filter.totalCopies = { $gt: 0 };
    if (available === 'false') filter.totalCopies = { $lte: 0 };

    if (sort === 'mostBorrowed') {
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: 'borrows',
            localField: '_id',
            foreignField: 'bookId',
            as: 'borrowRecords',
          },
        },
        { $set: { borrowCount: { $size: '$borrowRecords' } } },
        { $match: { borrowCount: { $gt: 0 } } },
        { $sort: { borrowCount: -1, createdAt: -1, _id: -1 } },
        { $project: { borrowRecords: 0, borrowCount: 0 } },
      ];
      if (limit) pipeline.push({ $limit: limit });
      return res.json(await books.aggregate(pipeline).toArray());
    }

    let cursor = books.find(filter).sort({ createdAt: -1, _id: -1 });
    if (limit) cursor = cursor.limit(limit);
    return res.json(await cursor.toArray());
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid book id.' });
  }

  try {
    const books = await getCollection('books');
    const book = await books.findOne({ _id: new ObjectId(req.params.id) });
    if (!book) return res.status(404).json({ message: 'Book not found.' });
    return res.json(book);
  } catch (error) {
    return next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  const errors = validateBook(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  try {
    const now = new Date();
    const payload = {
      title: req.body.title.trim(),
      author: req.body.author.trim(),
      category: req.body.category,
      image: req.body.image.trim(),
      description: req.body.description.trim(),
      totalCopies: Number(req.body.totalCopies),
      addedBy: { name: req.user.name, email: req.user.email },
      addedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const books = await getCollection('books');
    const result = await books.insertOne(payload);
    return res.status(201).json({ message: 'Book added successfully.', book: { ...payload, _id: result.insertedId } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid book id.' });
  }
  const errors = validateBook(req.body, true);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });

  const allowedFields = ['title', 'author', 'category', 'image', 'description', 'totalCopies'];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = typeof req.body[field] === 'string'
        ? req.body[field].trim()
        : Number(req.body[field]);
    }
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'Provide at least one book field to update.' });
  }
  updates.updatedAt = new Date();

  try {
    const books = await getCollection('books');
    const bookId = new ObjectId(req.params.id);
    const existing = await books.findOne({ _id: bookId });
    if (!existing) return res.status(404).json({ message: 'Book not found.' });
    if (existing.addedBy?.email?.toLowerCase() !== req.user.email) {
      return res.status(403).json({ message: 'You can only edit books you added.' });
    }
    if (
      updates.totalCopies !== undefined &&
      updates.totalCopies < existing.totalCopies
    ) {
      return res.status(400).json({ message: 'Available copies cannot be reduced below the current amount.' });
    }
    await books.updateOne({ _id: bookId }, { $set: updates });
    const book = await books.findOne({ _id: bookId });
    return res.json({ message: 'Book updated successfully.', book });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid book id.' });
  }

  try {
    const books = await getCollection('books');
    const borrows = await getCollection('borrows');
    const bookId = new ObjectId(req.params.id);
    const book = await books.findOne({ _id: bookId });
    if (!book) return res.status(404).json({ message: 'Book not found.' });
    if (book.addedBy?.email?.toLowerCase() !== req.user.email) {
      return res.status(403).json({ message: 'You can only delete books you added.' });
    }
    if (await borrows.findOne({ bookId, returned: false })) {
      return res.status(409).json({ message: 'Return all borrowed copies before deleting this book.' });
    }
    await books.deleteOne({ _id: bookId });
    return res.json({ message: 'Book deleted successfully.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
