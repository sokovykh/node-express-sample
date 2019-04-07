var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var postgres = require('./lib/postgres');
var expressValidator = require('express-validator');

app.use(bodyParser.json({ type: 'application/json' }));
app.use(expressValidator());

function validatePhoto(req, res, next) {
    req.checkBody('description', 'Invalid description').notEmpty();
    req.checkBody('album_id', 'Invalid album_id').isNumeric();
    var errors = req.validationErrors();
    if (errors) {
      var response = { errors: [] };
      errors.forEach(function(err) {
        response.errors.push(err.msg);
      });
      res.statusCode = 400;
      return res.json(response);
    }
    return next();
   }

function lookupPhoto(req, res, next) {
    console.log("TEST!" + req.params.id);
    // We access the ID param on the request object
    var photoId = req.params.id;
    // Build an SQL query to select the resource object by ID
    var sql = 'SELECT * FROM photo WHERE id = $1';
    postgres.client.query(sql, [photoId], function (err, results) {
        
        if (err) {
            console.error(err);
            res.statusCode = 500;
            return res.json({ errors: ['Could not retrieve photo'] });
        }
        
        // No results returned mean the object is not found
        if (results.rows.length === 0) {
            // We are able to set the HTTP status code on the res object
            res.statusCode = 404;
            return res.json({ errors: ['Photo not found'] });
        }
        // By attaching a Photo property to the request
        // Its data is now made available in our handler function
        console.log(results.rows);
        req.photo = results.rows[0];
        next();
    });
}

var photoRouter = express.Router();
photoRouter.get('/', function (req, res) { });
photoRouter.post('/', validatePhoto, function (req, res) {

    var sql = 'INSERT INTO photo (description, filepath, album_id) VALUES ($1,$2,$3) RETURNING id';
    // Retrieve the data to insert from the POST body
    var data = [
        req.body.description,
        req.body.filepath,
        req.body.album_id
    ];
    postgres.client.query(sql, data, function (err, result) {
        if (err) {
            // We shield our clients from internal errors, but log them
            console.error(err);
            res.statusCode = 500;
            return res.json({
                errors: ['Failed to create photo']
            });
        }
        var newPhotoId = result.rows[0].id;
        var sql = 'SELECT * FROM photo WHERE id = $1';
        postgres.client.query(sql, [newPhotoId], function (err, result) {
            if (err) {
                // We shield our clients from internal errors, but log them
                console.error(err);
                res.statusCode = 500;
                return res.json({
                    errors: ['Could not retrieve photo after create']
                });
            }
            // The request created a new resource object
            res.statusCode = 201;
            // The result of CREATE should be the same as GET
            res.json(result.rows[0]);
        });
    })
}
);

photoRouter.get('/:id([0-9]+)', lookupPhoto, function (req, res) {     
    res.json(req.photo); });
photoRouter.patch('/:id', lookupPhoto, function (req, res) { });
photoRouter.delete('/:id', lookupPhoto, function (req, res) { });
app.use('/photo', photoRouter);

var albumRouter = express.Router();
albumRouter.get('/', function (req, res) { });
albumRouter.post('/', function (req, res) { });
albumRouter.get('/:id', function (req, res) { });
albumRouter.patch('/:id', function (req, res) { });
albumRouter.delete('/:id', function (req, res) { });
app.use('/album', albumRouter);

module.exports = app;
