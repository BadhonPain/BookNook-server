const express = require('express');
const router = express.Router();

const { getCollection, ObjectId } = require('../lib/db');
const requireAuth = require('../middleware/auth');

const DEFAULT_LOAN_DAYS = 7;

router.post('/', requireAuth, async (req, res, next) => {
  const { bookId, returnDate } =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? req.body
      : {};
  if (typeof bookId !== 'string' || !ObjectId.isValid(bookId)) {
    return res.status(400).json({ message: 'Provide a valid book id.' });
  }

  const borrowDate = new Date();
  const finalReturnDate = returnDate
    ? new Date(returnDate)
    : new Date(borrowDate.getTime() + DEFAULT_LOAN_DAYS * 24 * 60 * 60 * 1000);
  if (Number.isNaN(finalReturnDate.getTime()) || finalReturnDate <= borrowDate) {
    return res.status(400).json({ message: 'Return date must be a valid future date.' });
  }

  const parsedBookId = new ObjectId(bookId);
  try {
    const books = await getCollection('books');
    const borrows = await getCollection('borrows');
    const book = await books.findOneAndUpdate(
      { _id: parsedBookId, totalCopies: { $gt: 0 } },
      { $inc: { totalCopies: -1 }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!book) {
      const existing = await books.findOne({ _id: parsedBookId }, { projection: { _id: 1 } });
      return existing
        ? res.status(409).json({ message: 'This book is not available right now.' })
        : res.status(404).json({ message: 'Book not found.' });
    }

    const now = new Date();
    const borrow = {
      bookId: parsedBookId,
      bookTitle: book.title,
      bookImage: book.image,
      userEmail: req.user.email,
      borrowDate,
      returnDate: finalReturnDate,
      returned: false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await borrows.insertOne(borrow);
      return res.status(201).json({
        message: 'Book borrowed successfully.',
        borrow: { ...borrow, _id: result.insertedId },
      });
    } catch (error) {
      await books.updateOne(
        { _id: parsedBookId },
        { $inc: { totalCopies: 1 }, $set: { updatedAt: new Date() } },
      );
      if (error.code === 11000) {
        return res.status(409).json({ message: 'You already have an active borrow for this book.' });
      }
      return next(error);
    }
  } catch (error) {
    return next(error);
  }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const borrows = await getCollection('borrows');
    const items = await borrows
      .find({ userEmail: req.user.email, returned: false })
      .sort({ borrowDate: -1 })
      .toArray();
    return res.json(items);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid borrow id.' });
  }

  try {
    const borrows = await getCollection('borrows');
    const books = await getCollection('books');
    const borrowId = new ObjectId(req.params.id);
    const borrow = await borrows.findOne(
      { _id: borrowId },
      { projection: { bookId: 1, userEmail: 1, returned: 1 } },
    );
    if (!borrow) return res.status(404).json({ message: 'Borrow record not found.' });
    if (borrow.userEmail !== req.user.email) {
      return res.status(403).json({ message: 'You can only return your own borrowed books.' });
    }
    if (borrow.returned) {
      return res.status(409).json({ message: 'This book has already been returned.' });
    }

    const result = await borrows.updateOne(
      { _id: borrowId, userEmail: req.user.email, returned: false },
      { $set: { returned: true, updatedAt: new Date() } },
    );
    if (!result.matchedCount) {
      return res.status(409).json({ message: 'This book has already been returned.' });
    }

    await books.updateOne(
      { _id: borrow.bookId },
      { $inc: { totalCopies: 1 }, $set: { updatedAt: new Date() } },
    );
    return res.json({ message: 'Book returned successfully.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
