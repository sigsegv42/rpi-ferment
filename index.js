// Generated by CoffeeScript 1.6.2
(function() {
  var EventEmitter, Thermometer, argv, config, emitSampleSignal, emitter, sample, sensor, sensors, shutdown, statsd, statsdClient, thermo, _i, _len;

  EventEmitter = require('events').EventEmitter;

  statsd = require('node-statsd').StatsD;

  argv = require('optimist').argv;

  config = require('./lib/config.js');

  Thermometer = require('./lib/thermometer.js');

  thermo = new Thermometer();

  thermo.unit('farenheight');

  if (argv.sensors) {
    console.log('Querying sensor ids...');
    sensors = thermo.sensors();
    for (_i = 0, _len = sensors.length; _i < _len; _i++) {
      sensor = sensors[_i];
      console.log(sensor);
    }
    return;
  }

  emitter = new EventEmitter();

  shutdown = false;

  statsdClient = new statsd();

  emitSampleSignal = function() {
    emitter.emit('sample');
  };

  sample = function() {
    var sensorReading, _j, _len1, _ref;

    _ref = config.sensors;
    for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
      sensor = _ref[_j];
      sensorReading = thermo.temperature(sensor.id);
      if (argv.debug) {
        console.log(sensorReading);
      }
      if (!argv.nolog) {
        statsdClient.gauge(sensorName, sensorReading);
      }
    }
    if (!shutdown) {
      setTimeout(emitSampleSignal, config.pollFrequency);
    }
  };

  emitter.on('sample', sample);

  setTimeout(emitSampleSignal, config.pollFrequency);

}).call(this);
