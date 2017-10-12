var privateMembers = {
    waiverError: 'One or more of your selected tours requires a waiver',
    guestCountError: 'One or more of your selected tour exceeds maximum number of guests that can be accomodated'
};

module.exports = {
    checkWaivers: function(req, res, next) {
        var cart = req.session.cart;

        if(!cart) return next();

        if(cart.some(function(item) {
            return item.product.requiresWaiver;
        })) {
            if(!cart.warnings) cart.warnings = [];

            cart.warnings.push(privateMembers.waiverError);
        }

        next();
    },

    checkGuestCounts: function(req, res, next) {
        var cart = req.session.cart;

        if(!cart) return next();

        if(cart.some(function(item) {
            return item.guests > item.product.maximumGuests;
        })) {
            if(!cart.errors) cart.errors = [];

            cart.errors.push(privateMembers.guestCountError);
        }
    }
};
