var mongoose, vacationSchema, Vacation;

mongoose = require('mongoose');

vacationSchema = mongoose.Schema({
    name: String,
    slug: String,
    category: String,
    sku: String,
    description: String,
    priceInCents: Number,
    tags: [String],
    inSeason: Boolean,
    available: Boolean,
    requiresWaiver: Boolean,
    maximumGuests: Number,
    notes: String,
    packagesSold: Number,
});

// methods in model has to be defined before the model is defined
vacationSchema.methods.getDisplayPrice = function() {
    return '$' + (this.priceInCents / 100).toFixed(2);
}

// Vacation model is defined here
Vacation = mongoose.model('Vacation', vacationSchema);

module.exports = Vacation;
