const mongoose = require('mongoose');

const borrowSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    bookTitle: {
      type: String,
      required: true,
    },
    bookImage: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    borrowDate: {
      type: Date,
      default: Date.now,
    },
    returnDate: {
      type: Date,
      required: true,
    },
    returned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

borrowSchema.index({ bookId: 1, userEmail: 1, returned: 1 });

module.exports = mongoose.model('Borrow', borrowSchema);
