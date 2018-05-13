var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var multer = require('multer');
var xlstojson = require("xls-to-json-lc");
var xlsxtojson = require("xlsx-to-json-lc");
var cors = require('cors');
var regression = require('regression');
// import regression from 'regression';

app.use(cors());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

app.use(bodyParser.json());

var storage = multer.diskStorage({ //multers disk storage settings
  destination: function(req, file, cb) {
    cb(null, './uploads/')
  },
  filename: function(req, file, cb) {
    var datetimestamp = Date.now();
    cb(null, file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1])
  }
});
var upload = multer({ //multer settings
  storage: storage,
  fileFilter: function(req, file, callback) { //file filter
    if (['xls', 'xlsx'].indexOf(file.originalname.split('.')[file.originalname.split('.').length - 1]) === -1) {
      return callback(new Error('Wrong extension type'));
    }
    callback(null, true);
  }
}).single('file');
/** API path that will upload the files */
app.post('/upload', function(req, res) {
  var exceltojson;
  upload(req, res, function(err) {
    if (err) {
      res.json({
        error_code: 1,
        err_desc: err
      });
      return;
    }
    /** Multer gives us file info in req.file object */
    if (!req.file) {
      res.json({
        error_code: 1,
        err_desc: "No file passed"
      });
      return;
    }
    /** Check the extension of the incoming file and
     *  use the appropriate module
     */
    if (req.file.originalname.split('.')[req.file.originalname.split('.').length - 1] === 'xlsx') {
      exceltojson = xlsxtojson;
    } else {
      exceltojson = xlstojson;
    }
    try {
      exceltojson({
        input: req.file.path,
        output: null, //since we don't need output.json
        lowerCaseHeaders: true
      }, function(err, result) {
        if (err) {
          return res.json({
            error_code: 1,
            err_desc: err,
            data: null
          });
        }


        //doing data manipulaiton
        var regArray = [];
        var dataGraph2 = [];

        result.forEach(function(row) {
          if (row['first year'] && row['second year']) {
            regArray.push([parseInt(row['first year']), parseInt(row['second year'])])

          }
          if (parseInt(row['% of bricks'].slice(0, -1)) >= 70) {
            dataGraph2.push([parseInt(row['% of bricks'].slice(0, -1)), parseInt(row['growth'].slice(0, -1))])
          }
        })


        regArray.sort(function(a, b) {
          if (a[0] > b[0]) {
            return 1;

          } else if (a[0] < b[0]) {
            return -1;
          } else
            return 0
        })

        dataGraph2.sort(function(a, b) {
          if (a[0] > b[0]) {
            return 1;

          } else if (a[0] < b[0]) {
            return -1;
          } else
            return 0
        })

        var weight = (regression.linear(regArray)).equation[0];

        var linearArray = [];
        regArray.forEach(function(row) {
          linearArray.push([row[0], weight * row[0]])
        })



        res.json({
          "error_code": 0,
          "err_desc": null,
          "regArray": regArray,
          "linearArray": linearArray,
          "dataGraph2": dataGraph2
        });
      });
    } catch (e) {
      res.json({
        error_code: 1,
        err_desc: "Corrupted excel file"
      });
    }
  })
});

app.use(express.static(__dirname + '/client'));

app.listen('3000', function() {
  console.log('running on 3000...');
});