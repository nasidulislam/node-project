var mongoose, vacationInSeasonListenerSchema, vacationInSeasonListener;

mongoose = require('mongoose');

vacationInSeasonListenerSchema = mongoose.Schema({
    email: String,
    skus: [String]
});

vacationInSeasonListener = mongoose.model('vacationInSeasonListener', vacationInSeasonListenerSchema);

module.exports = vacationInSeasonListener;
