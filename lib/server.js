// Generated by CoffeeScript 1.6.2
(function() {
  var app, config, express;

  express = require('express');

  config = require('./express-config.js');

  app = module.exports = express();

  config.configure(express, app);

}).call(this);
