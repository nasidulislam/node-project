var express, formidable, app, handlebar, http, fs, mongoose, mongoSessionStore, sessionStore,
    fortune, credentials, cartValidation, Vacation, vacationInSeasonListener;

// app configs
express = require('express');
formidable = require('formidable');
http = require('http');
fs = require('fs');
mongoose = require('mongoose');
mongoSessionStore = require('session-mongoose')(require('connect'));

// libs and models
fortune = require('./lib/fortune.js');
credentials = require('./credentials.js');
cartValidation = require('./lib/cartValidation.js');
Vacation = require('./models/vacation.js');
vacationInSeasonListener = require('./models/vacationInSeasonListener.js');

app = express();

// set up handlebars view engine
handlebars = require('express-handlebars').create({
    defaultLayout:'main',
    helpers: {
        section: function(name, options){
            if(!this._sections) this._sections = {};
            this._sections[name] = options.fn(this);
            return null;
        }
    }
});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

app.set('port', process.env.PORT || 3000);

app.use(express.static(__dirname + '/public'));

app.use(require('body-parser')());
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')({
    resave: false,
    saveUninitialized: false,
    secret: credentials.cookieSecret,
    store: sessionStore
}));

/* set 'showTests' context property if the querystring contains test=1 */
app.use(function(req, res, next){
	res.locals.showTests = app.get('env') !== 'production' &&
		req.query.test === '1';
	next();
});

/* begin Miscellaneous functions */

// mocked weather data
function getWeatherData(){
    return {
        locations: [
            {
                name: 'Portland',
                forecastUrl: 'http://www.wunderground.com/US/OR/Portland.html',
                iconUrl: 'http://icons-ak.wxug.com/i/c/k/cloudy.gif',
                weather: 'Overcast',
                temp: '54.1 F (12.3 C)',
            },
            {
                name: 'Bend',
                forecastUrl: 'http://www.wunderground.com/US/OR/Bend.html',
                iconUrl: 'http://icons-ak.wxug.com/i/c/k/partlycloudy.gif',
                weather: 'Partly Cloudy',
                temp: '55.0 F (12.8 C)',
            },
            {
                name: 'Manzanita',
                forecastUrl: 'http://www.wunderground.com/US/OR/Manzanita.html',
                iconUrl: 'http://icons-ak.wxug.com/i/c/k/rain.gif',
                weather: 'Light Rain',
                temp: '55.0 F (12.8 C)',
            },
        ],
    };
}

// mocked NewsletterSignup
function NewsletterSignup(){}
NewsletterSignup.prototype.save = function(cb){
	cb();
};

// make sure data directory exists
var dataDir, vacationPhotoDir;

dataDir = __dirname + '/data';
vacationPhotoDir = dataDir + '/vacation-photo';

fs.existsSync(dataDir || fs.mkdirSync(dataDir));
fs.existsSync(vacationPhotoDir || fs.mkdirSync(vacationPhotoDir));

function saveContestEntry(contestName, email, year, month, photoPath) {
    // TODO...this will come later
}

// creating database connection
var options = {
    server: {
        socketOptions: { keepAlive: 1 }
    }
};

switch(app.get('env')) {
    case 'development':
        mongoose.connect(credentials.mongo.development.uri, options);
        break;
    case 'production':
        mongoose.connect(credentials.mongo.production.uri, options);
        break;
    default:
        throw new Error('Unknown execution environment: ' + app.get('env'));
}

// seeding initial vacation data
Vacation.find(function(err, vacations){
    if(vacations.length) return;

    new Vacation({
        name: 'Hood River Day Trip',
        slug: 'hood-river-day-trip',
        category: 'Day Trip',
        sku: 'HR199',
        description: 'Spend a day sailing on the Columbia and ' +
            'enjoying craft beers in Hood River!',
        priceInCents: 9995,
        tags: ['day trip', 'hood river', 'sailing', 'windsurfing', 'breweries'],
        inSeason: true,
        maximumGuests: 16,
        available: true,
        packagesSold: 0,
    }).save();

    new Vacation({
        name: 'Oregon Coast Getaway',
        slug: 'oregon-coast-getaway',
        category: 'Weekend Getaway',
        sku: 'OC39',
        description: 'Enjoy the ocean air and quaint coastal towns!',
        priceInCents: 269995,
        tags: ['weekend getaway', 'oregon coast', 'beachcombing'],
        inSeason: false,
        maximumGuests: 8,
        available: true,
        packagesSold: 0,
    }).save();

    new Vacation({
        name: 'Rock Climbing in Bend',
        slug: 'rock-climbing-in-bend',
        category: 'Adventure',
        sku: 'B99',
        description: 'Experience the thrill of rock climbing in the high desert.',
        priceInCents: 289995,
        tags: ['weekend getaway', 'bend', 'high desert', 'rock climbing', 'hiking', 'skiing'],
        inSeason: true,
        requiresWaiver: true,
        maximumGuests: 4,
        available: false,
        packagesSold: 0,
        notes: 'The tour guide is currently recovering from a skiing accident.',
    }).save();
});

sessionStore = new mongoSessionStore({
    url: credentials.mongo[app.get('env')].uri
});

function convertFromUSD(value, currency){
    switch(currency){
    	case 'USD': return value * 1;
        case 'GBP': return value * 0.6;
        case 'BTC': return value * 0.0023707918444761;
        default: return NaN;
    }
}

/* end Miscellaneous functions */

/* begin MIDDLEWARE setup */

// create domain to handle errors
app.use(function(req, res, next) {
    var domain = require('domain').create();

    domain.on('error', function(error) {
        console.error('DOMAIN ERROR CAUGHT\n', error.stack);

        try {
            // failsafe shutdown in 5 seconds
            setTimeout(function() {
                console.error('Failsafe shutdown initiated !!');
                process.exit(1);
            }, 5000);

            // disconnect from cluster and stop taking new requests
            var worker = require('cluster').worker;

            if(worker) worker.disconnect();
            server.close();

            try {
                // attempt to use Express error route
                next(error);
            } catch(error) {
                // if Express error route fails, use vanilla Node response
                console.error('Express error mechanism failed.\n', error.stack);
                res.statusCode = 500;
                res.setHeader('content-type', 'text/plain');
                res.end('Server error');
            }
        } catch(error) {
            console.error('Unable to send 500 response\n', error.stack);
        }
    });

    // add request and response objects to domain and execute remaining chain
    domain.add(req);
    domain.add(res);
    domain.run(next);
});

// weather
app.use(function(req, res, next) {
	if(!res.locals.partials) res.locals.partials = {};
 	res.locals.partials.weatherContext = getWeatherData();
 	next();
});

// flash message
app.use(function(req, res, next){
	// if there's a flash message, transfer
	// it to the context, then clear it
	res.locals.flash = req.session.flash;
	delete req.session.flash;
	next();
});

// waiver
app.use(cartValidation.checkWaivers);

// check guest count
app.use(cartValidation.checkGuestCounts);

/* end MIDDLEWARE setup */

/* begin GET requests / server side routing */

app.get('/', function(req, res) {
	res.render('home');
});
app.get('/about', function(req,res) {
	res.render('about', {
		fortune: fortune.getFortune(),
		pageTestScript: '/qa/tests-about.js'
	} );
});

app.get('/tours/:tour', function(req, res, next){
	Product.findOne({ category: 'tour', slug: req.params.tour }, function(err, tour){
		if(err) return next(err);
		if(!tour) return next();
		res.render('tour', { tour: tour });
	});
});

app.get('/adventures/:subcat/:name', function(req, res, next){
	Product.findOne({ category: 'adventure', slug: req.params.subcat + '/' + req.params.name  }, function(err, adventure){
		if(err) return next(err);
		if(!adventure) return next();
		res.render('adventure', { adventure: adventure });
	});
});

app.get('/tours/request-group-rate', function(req, res) {
	res.render('tours/request-group-rate');
});

app.get('/newsletter', function(req, res) {
    res.render('newsletter', {csrf: 'dummy CSRF value'});
});

app.get('/thank-you', function(req, res) {
	res.render('thank-you');
});

app.get('/contest/vacation-photo', function(req, res){
	var now = new Date();
	res.render('contest/vacation-photo', {
        year: now.getFullYear(),
        month: now.getMonth() });
});

app.get('/nursery-rhyme', function(req, res){
	res.render('nursery-rhyme');
});

app.get('/data/nursery-rhyme', function(req, res){
	res.json({
		animal: 'gitquirrel',
		bodyPart: 'tail',
		adjective: 'bushy',
		noun: 'heck',
	});
});

app.get('/newsletter', function(req, res){
	res.render('newsletter');
});

app.get('/newsletter/archive', function(req, res){
	res.render('newsletter/archive');
});

app.get('/tours/:tour', function(req, res, next){
	Product.findOne({ category: 'tour', slug: req.params.tour }, function(err, tour){
		if(err) return next(err);
		if(!tour) return next();
		res.render('tour', { tour: tour });
	});
});

app.get('/adventures/:subcat/:name', function(req, res, next){
	Product.findOne({ category: 'adventure', slug: req.params.subcat + '/' + req.params.name  }, function(err, adventure){
		if(err) return next(err);
		if(!adventure) return next();
		res.render('adventure', { adventure: adventure });
	});
});

app.get('/cart', function(req, res){
	var cart = req.session.cart || (req.session.cart = []);
	res.render('cart', { cart: cart });
});

app.get('/vacations', function(req, res) {
    Vacation.find({
        available: true
    }, function(error, vacations) {
        var currency, context;

        currency = req.session.currency || 'USD';
        context = {
            currency: currency,
            vacations: vacations.map(function(vacation) {
                return {
                    sku: vacation.sku,
                    name: vacation.name,
                    description: vacation.description,
                    inSeason: vacation.inSeason,
                    price: convertFromUSD(vacation.priceInCents/100, currency),
                    qty: vacation.qty,
                };
            })
        };

        switch(currency){
	    	case 'USD': context.currencyUSD = 'selected'; break;
	        case 'GBP': context.currencyGBP = 'selected'; break;
	        case 'BTC': context.currencyBTC = 'selected'; break;
	    }

        res.render('vacations', context);
    });
});

app.get('/notify-me-when-in-season', function(req, res) {
    res.render('notify-me-when-in-season', {
        sku: req.query.sku
    });
});

app.get('/cart/add', function(req, res, next){
	var cart = req.session.cart || (req.session.cart = { items: [] });
	Vacation.findOne({ sku: req.query.sku }, function(err, vacation){
		if(err) return next(err);
		if(!vacation) return next(new Error('Unknown vacation SKU: ' + req.query.sku));
		cart.items.push({
			vacation: vacation,
			guests: req.body.guests || 1,
		});
		res.redirect(303, '/cart');
	});
});

app.get('/contest/vacation-photo/entries', function(req, res){
	res.render('contest/vacation-photo/entries');
});

app.get('/set-currency/:currency', function(req, res) {
    req.session.currency = req.params.currency;
    return res.redirect(303, '/vacations');
})

/* end GET requests / server side routing */

/* begin POST requests */

app.post('/process', function(req, res) {
    console.log('Form (from querystring): ' + req.query.form);
    console.log('CSRF token (from hidden form field): ' + req.body._csrf);
    console.log('Name (from visible form field): ' + req.body.name);
    console.log('Email (from visible form field): ' + req.body.email);
    if(req.xhr || req.accepts('json,html')==='json'){
        // if there were an error, we would send { error: 'error description' }
        res.send({ success: true });
    } else{
        // if there were an error, we would redirect to an error page
        res.redirect(303, '/thank-you');
    }
});

app.post('/contest/vacation-photo/:year/:month', function(req, res){
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files){
        if(err) {
            req.session.flash = {
                type: 'danger',
                intro: 'Oops!',
                message: 'There was an error processing your submission. ' +
                    'Pelase try again.',
            };
            return res.redirect(303, '/contest/vacation-photo');
        }
        var photo = files.photo;
        var dir = vacationPhotoDir + '/' + Date.now();
        var path = dir + '/' + photo.name;
        fs.mkdirSync(dir);
        fs.renameSync(photo.path, dir + '/' + photo.name);
        saveContestEntry('vacation-photo', fields.email,
            req.params.year, req.params.month, path);
        req.session.flash = {
            type: 'success',
            intro: 'Good luck!',
            message: 'You have been entered into the contest.',
        };
        return res.redirect(303, '/contest/vacation-photo/entries');
    });
});

app.post('/newsletter', function(req, res) {
    var name, email;

    name = req.body.name || '';
    email = req.body.email || '';

    // input validation
    if(!email.match(VALID_EMAIL_REGEX)) {
        if(req.xhr) return res.json({
            error: 'Invalid email address'
        });

        req.session.flash = {
            type: 'danger',
            intro: 'Validation error !!',
            message: 'The email address you entered was not valid'
        };

        return res.redirect(303, '/newsletter/archive');
    };

    new NewsletterSignup({
        name: name,
        email: email
    }).save(function(err) {
        if(err) {
            if(req.xhr) return res.json({
                error: 'Database error.'
            });

            req.session.flash = {
                type: 'danger',
                intro: 'Database error !!',
                message: 'There was an error connecting to the database; /n Try again later.'
            };

            return res.redirect(303, '/newsletter/archive');
        };

        if(req.xhr) return res.json({
            success: true
        });

        req.session.flash = {
            type: 'success',
            intro: 'Thank you !!',
            message: 'You have successfully signed up for Meadowlark Travel newsletter'
        };

        return res.redirect(303, '/newsletter/archive');
    });
});

app.post('/cart/add', function(req, res, next){
	var cart = req.session.cart || (req.session.cart = []);
	Product.findOne({ sku: req.body.sku }, function(err, product){
		if(err) return next(err);
		if(!product) return next(new Error('Unknown product SKU: ' + req.body.sku));
		cart.push({
			product: product,
			guests: req.body.guests || 0,
		});
		res.redirect(303, '/cart');
	});
});

app.post('/vacations', function(req, res){
    Vacation.findOne({ sku: req.body.purchaseSku }, function(err, vacation){
        if(err || !vacation) {
            req.session.flash = {
                type: 'warning',
                intro: 'Ooops!',
                message: 'Something went wrong with your reservation; ' +
                    'please <a href="/contact">contact us</a>.',
            };
            return res.redirect(303, '/vacations');
        }
        vacation.packagesSold++;
        vacation.save();
        req.session.flash = {
            type: 'success',
            intro: 'Thank you!',
            message: 'Your vacation has been booked.',
        };
        res.redirect(303, '/vacations');
    });
});

app.post('/notify-me-when-in-season', function(req, res){
    VacationInSeasonListener.update(
        { email: req.body.email },
        { $push: { skus: req.body.sku } },
        { upsert: true },
	    function(err){
	        if(err) {
	        	console.error(err.stack);
	            req.session.flash = {
	                type: 'danger',
	                intro: 'Ooops!',
	                message: 'There was an error processing your request.',
	            };

	            return res.redirect(303, '/vacations');
	        }

	        req.session.flash = {
	            type: 'success',
	            intro: 'Thank you!',
	            message: 'You will be notified when this vacation is in season.',
	        };

	        return res.redirect(303, '/vacations');
	    }
	);
});

/* end POST requests */

/* begin logging */
switch (app.get('env')) {
    case 'development':
        app.use(require('morgan')('dev'));
        break;
    case 'production':
        app.use(require('express-logger')({
            path: __dirname + '/log/requests.log'
        }));
        break;
    default:
        break;
}
/* end logging */

// 404 catch-all handler (middleware)
app.use(function(req, res, next) {
	res.status(404);
	res.render('404');
});

// 500 error handler (middleware)
app.use(function(err, req, res, next) {
	console.error(err.stack);
	res.status(500);
	res.render('500');
});

function startServer() {
    var server = http.createServer(app).listen(app.get('port'), function(){
      console.log( 'Express started in ' + app.get('env') +
        ' mode on http://localhost:' + app.get('port') +
        '; press Ctrl-C to terminate.' );
    });
}

if(require.main === module){
    // application run directly; start app server
    startServer();
} else {
    // application imported as a module via "require": export function to create server
    module.exports = startServer;
}
