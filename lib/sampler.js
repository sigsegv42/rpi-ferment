// Generated by CoffeeScript 1.6.2
(function() {
  var EventEmitter, Sampler, Thermometer,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Thermometer = require('./thermometer.js');

  EventEmitter = require('events').EventEmitter;

  Sampler = (function(_super) {
    __extends(Sampler, _super);

    Sampler.prototype.shutdown_ = false;

    Sampler.prototype.frequency_ = 1000;

    Sampler.prototype.sensors_ = {};

    Sampler.prototype.thermo_ = null;

    Sampler.prototype.sampling_ = false;

    Sampler.prototype.debug_ = false;

    function Sampler(frequency, sensors, units, debug) {
      this.scheduleSample = __bind(this.scheduleSample, this);
      this.sample = __bind(this.sample, this);
      this.emitSampleSignal = __bind(this.emitSampleSignal, this);
      this.startSampling = __bind(this.startSampling, this);      this.sensors_ = sensors;
      this.frequency_ = frequency;
      this.debug_ = debug;
      this.thermo_ = new Thermometer(units);
      this.on('sample', this.sample);
    }

    Sampler.prototype.startSampling = function() {
      if (this.sampling_) {
        return;
      }
      if (this.debug_) {
        console.log('Scheduling sensor sampling...');
      }
      this.scheduleSample();
    };

    Sampler.prototype.emitSampleSignal = function() {
      this.emit('sample');
    };

    Sampler.prototype.sample = function() {
      var sensor, sensorReading, _i, _len, _ref;

      _ref = this.sensors_;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        sensor = _ref[_i];
        sensorReading = this.thermo_.temperature(sensor.id);
        if (this.debug_) {
          console.log(sensor.name + '[' + sensor.id + '] : ' + sensorReading);
        }
        this.emit('read', sensor.name, sensorReading);
      }
      if (!this.shutdown_) {
        this.scheduleSample();
      }
    };

    Sampler.prototype.scheduleSample = function() {
      setTimeout(this.emitSampleSignal, this.frequency_);
      this.sampling_ = true;
    };

    return Sampler;

  })(EventEmitter);

  module.exports = Sampler;

}).call(this);
