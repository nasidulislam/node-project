var express, app, handlebars;

express = require('express');
app = express();

// setup handlebars view engine
handlebars = require('express3-handlebars')
                    .create({defaultLayout: 'main'});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

app.set('port', process.env.PORT || 3000);
app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.render('home');
});

app.get('/about', function (req, res) {
    var fortunes, randomFortune;
    fortunes = [
        "Conquer your fears or they will conquer you.",
        "Rivers need springs.",
        "Do not fear what you don't know.",
        "You will have a pleasant surprise.",
        "Whenever possible, keep it simple.",
    ];

    randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    res.render('about', {fortune: randomFortune});
});

// 404 catch all handler (middleware)
app.use(function (req, res, next) {
    res.status(404);
    res.render('404');
});

app.use(function (err, req, res, next) {
    res.status(500);
    res.render('500');
    console.error(err.stack);
});

app.listen(app.get('port'), function () {
    console.log('App started using express at localhost//' + app.get('port'));
});
