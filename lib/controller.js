// Generated by CoffeeScript 1.6.2
(function() {
  var Controller, ExpressApp, IO, PID, Sampler, Sockets, mongoose, statsd,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  statsd = require('node-statsd').StatsD;

  Sampler = require('./sampler.js');

  IO = require('./io.js');

  Sockets = require('./sockets.js');

  ExpressApp = require('./server.js');

  mongoose = require('mongoose');

  PID = require('rpi-pid').PID;

  require('./orm/profile.js');

  Controller = (function() {
    Controller.prototype.config_ = {};

    Controller.prototype.state_ = {};

    Controller.prototype.io_ = null;

    Controller.prototype.debug_ = false;

    Controller.prototype.statsd_ = null;

    Controller.prototype.sampler_ = null;

    Controller.prototype.sockets_ = null;

    Controller.prototype.profiles_ = [];

    function Controller(config, debug, nolog) {
      this.processSample = __bind(this.processSample, this);
      this.checkSensorProfile = __bind(this.checkSensorProfile, this);
      this.getMode = __bind(this.getMode, this);
      this.setMode = __bind(this.setMode, this);
      this.getSv = __bind(this.getSv, this);
      this.setSv = __bind(this.setSv, this);
      this.setGpio = __bind(this.setGpio, this);
      this.getGpio = __bind(this.getGpio, this);
      this.config = __bind(this.config, this);
      this.debug = __bind(this.debug, this);
      this.run = __bind(this.run, this);
      this.loadProfiles = __bind(this.loadProfiles, this);
      var model, query, sensor, _i, _len, _ref;

      this.debug_ = debug;
      this.config_ = config;
      if (!nolog) {
        if (this.debug_) {
          console.log('Creating statsd client...');
        }
        this.statsd_ = new statsd();
      }
      _ref = config.sensors;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        sensor = _ref[_i];
        this.state_[sensor.name] = {
          sv: 0,
          pv: 0,
          gpio: false,
          pid: null,
          mode: 'manual',
          profile: null,
          cycle: 0,
          control: null,
          cooldown: 0
        };
        if (sensor.type !== 'ambient') {
          this.state_[sensor.name].channel = sensor.gpio;
          this.state_[sensor.name].control = sensor.control;
          this.state_[sensor.name].cycle = sensor.cycle;
        }
      }
      model = mongoose.model('Profile');
      query = model.find();
      query.where('active', true);
      query.exec(this.loadProfiles);
      this.io_ = new IO(this.debug_, 'out');
      this.sockets_ = new Sockets(this);
      this.sockets_.run();
      this.sampler_ = new Sampler(this.config_.pollFrequency, this.config_.sensors, this.config_.sensorUnit, this.debug_);
      this.sampler_.on('read', this.processSample);
      ExpressApp.set('controller', this);
      if (this.debug_) {
        console.log('Express API listening on port [' + this.config_.apiPort + ']');
      }
      ExpressApp.listen(this.config_.apiPort);
      return;
    }

    Controller.prototype.loadProfiles = function(err, profiles) {
      var profile, value, _i, _len, _results;

      if (err) {
        if (this.debug_) {
          console.log(err);
        }
        return;
      }
      this.profiles_ = profiles;
      _results = [];
      for (_i = 0, _len = profiles.length; _i < _len; _i++) {
        profile = profiles[_i];
        this.state_[profile.sensor].profile = profile;
        this.state_[profile.sensor].mode = profile.control_mode;
        if (profile.control_mode === 'pid') {
          this.state_[profile.sensor].pid = new PID();
        }
        if (profile.overrides.length > 0 && profile.overrides[profile.overrides.length - 1].action !== 'resume') {
          value = false;
          if (profile.overrides[profile.overrides.length - 1].action === 'on') {
            value = true;
          }
          this.setGpio(profile.sensor, value);
        }
        if (this.debug_) {
          _results.push(console.log('Bound active profile [' + profile.name + '] to sensor [' + profile.sensor + ']'));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Controller.prototype.run = function() {
      var sensor, _i, _len, _ref;

      _ref = this.config_.sensors;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        sensor = _ref[_i];
        if (sensor.gpio != null) {
          this.io_.setupChannel(sensor.gpio, 'out');
        }
      }
      return this.sampler_.startSampling();
    };

    Controller.prototype.debug = function() {
      return this.debug_;
    };

    Controller.prototype.config = function() {
      return this.config_;
    };

    Controller.prototype.getGpio = function(sensor) {
      return this.state_[sensor].gpio;
    };

    Controller.prototype.setGpio = function(sensor, value) {
      var controlName, controlSignalCompletion,
        _this = this;

      if (this.state_[sensor].gpio === value) {
        return;
      }
      this.state_[sensor].gpio = value;
      controlSignalCompletion = function() {
        var data;

        if (_this.debug_) {
          console.log('GPIO channel state updated');
          data = {
            sensor: sensor,
            state: value
          };
          _this.sockets_.io_.sockets.emit('setgpio', data);
        }
      };
      controlName = sensor + '_gpio_' + this.state_[sensor].channel;
      this.io_.signal(this.state_[sensor].channel, value, controlSignalCompletion);
      if (!this.statsd_) {
        return;
      }
      if (!value) {
        this.statsd_.decrement(controlName);
      } else {
        this.statsd_.increment(controlName);
      }
    };

    Controller.prototype.setSv = function(sensor, value) {
      var data;

      this.state_[sensor].sv = value;
      data = {
        sensor: sensor,
        value: value
      };
      this.sockets_.io_.sockets.emit('setsv', data);
    };

    Controller.prototype.getSv = function(sensor) {
      return this.state_[sensor].sv;
    };

    Controller.prototype.setMode = function(sensor, mode) {
      this.state_[sensor].mode = mode;
    };

    Controller.prototype.getMode = function(sensor) {
      return this.state_[sensor].mode;
    };

    Controller.prototype.getStepDuration = function(step) {
      var hourDuration;

      hourDuration = 0;
      if (step.units === 'days') {
        hourDuration = step.duration * 24;
      } else if (step.units === 'hours') {
        hourDuration = step.duration;
      }
      return hourDuration;
    };

    Controller.prototype.activateStep = function(sensor, step) {
      var history, now;

      now = new Date();
      step.active = true;
      step.start_time = now;
      if (this.debug_) {
        console.log('Enabling step [' + step.name + '] at [' + now.toString() + ']');
      }
      history = {
        action: 'start_step',
        state: 'on',
        time: now
      };
      this.state_[sensor].profile.history.push(history);
    };

    Controller.prototype.deactivateStep = function(sensor, step) {
      var history, now;

      now = new Date();
      step.end_time = now;
      step.active = false;
      step.completed = true;
      if (this.debug_) {
        console.log('Completed step [' + step.name + '] at [' + now.toString() + ']');
      }
      history = {
        action: 'end_step',
        state: 'off',
        time: now
      };
      this.state_[sensor].profile.history.push(history);
    };

    Controller.prototype.interpolateStepTemperature = function(step) {
      var currentTemperature, duration, now, offset, progress, range;

      range = 0;
      if (step.start_temperature > step.end_temperature) {
        range = step.start_temperature - step.end_temperature;
      } else {
        range = step.end_temperature - step.start_temperature;
      }
      if (range === 0) {
        return step.start_temperature;
      }
      duration = 3600000 * this.getStepDuration(step);
      now = new Date();
      progress = now.getTime() - step.start_time.getTime();
      offset = (progress / duration) * range;
      if (step.start_temperature > step.end_temperature) {
        currentTemperature = step.start_temperature + offset;
      } else {
        currentTemperature = step.start_temperature - offset;
      }
      return currentTemperature;
    };

    Controller.prototype.activateProfile = function(sensor) {
      var history, profileStart;

      profileStart = new Date();
      if (this.debug_) {
        console.log('Enabling profile at [' + profileStart.toString() + ']');
      }
      this.state_[sensor].profile.start_time = profileStart;
      history = {
        action: 'start_profile',
        state: 'on',
        time: profileStart
      };
      this.state_[sensor].profile.history.push(history);
      return profileStart;
    };

    Controller.prototype.checkSensorProfile = function(sensor) {
      var activeStep, currentStepTemperature, hourDuration, modified, now, override, profileDuration, profileStart, saveHandler, step, stepEnd, uncompleted, _i, _len, _ref;

      override = false;
      if (this.state_[sensor].profile === null) {
        return override;
      }
      activeStep = null;
      now = new Date();
      profileStart = this.state_[sensor].profile.start_time;
      modified = false;
      if (profileStart === void 0) {
        profileStart = this.activateProfile(sensor);
        modified = true;
      }
      profileDuration = 0;
      uncompleted = false;
      _ref = this.state_[sensor].profile.steps;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        step = _ref[_i];
        hourDuration = this.getStepDuration(step);
        profileDuration += hourDuration;
        if (step.completed === true) {
          continue;
        }
        stepEnd = new Date();
        stepEnd.setDate(profileStart.getDate());
        stepEnd.setHours(stepEnd.getHours() + profileDuration);
        if (stepEnd > now) {
          activeStep = step;
          uncompleted = true;
          if (step.active === false) {
            this.activateStep(sensor, step);
            modified = true;
          }
          break;
        } else {
          if (step.active === true) {
            this.deactivateStep(sensor, step);
            modified = true;
          }
        }
      }
      if (modified === true) {
        saveHandler = function(err) {
          if (err) {
            return console.log('Error saving profile: ' + err);
          }
        };
        this.state_[sensor].profile.save(saveHandler);
      }
      if (this.state_[sensor].profile.overrides.length > 0) {
        if (this.state_[sensor].profile.overrides[this.state_[sensor].profile.overrides.length - 1].action !== 'resume') {
          override = true;
        }
      }
      if (uncompleted === true && this.state_[sensor].profile.control_mode !== this.state_[sensor].mode) {
        if (this.debug_) {
          console.log('Switching sensor [' + sensor + '] control mode from [' + this.state_[sensor].mode + '] to [' + this.state_[sensor].profile.control_mode + ']');
        }
        this.state_[sensor].mode = this.state_[sensor].profile.control_mode;
      }
      if (activeStep !== null) {
        if (activeStep.start_temperature !== activeStep.end_temperature) {
          currentStepTemperature = this.interpolateStepTemperature(activeStep);
        } else {
          currentStepTemperature = activeStep.start_temperature;
        }
        if (this.state_[sensor].sv !== currentStepTemperature) {
          if (this.debug_) {
            console.log('Setting sensor [' + sensor + '] SV to Profile [' + this.state_[sensor].profile.name + '] Step [' + activeStep.name + '] temperature [' + activeStep.temperature + ']');
          }
          this.state_[sensor].sv = activeStep.temperature;
        }
      }
      if (uncompleted === false && this.state_[sensor].mode !== 'none') {
        if (this.debug_) {
          console.log('All profile steps completed. Switching sensor mode to [none].');
        }
        this.state_[sensor].mode = 'none';
      }
      return override;
    };

    Controller.prototype.processSample = function(sensor, value) {
      var data, disable, enable, override, statsdCallback, ts,
        _this = this;

      this.state_[sensor].pv = value;
      data = {
        sensor: sensor,
        pv: value
      };
      this.sockets_.io_.sockets.emit('setpv', data);
      if (this.debug_) {
        console.log('Processing sample value [' + value + '] for sensor [' + sensor + ']');
      }
      statsdCallback = function() {
        if (_this.debug_) {
          return console.log('statsd gauge data sent.');
        }
      };
      if (this.statsd_) {
        this.statsd_.gauge(sensor, value, 1, statsdCallback);
      }
      if (this.state_[sensor].gpio == null) {
        return;
      }
      override = this.checkSensorProfile(sensor);
      if (this.state_[sensor].cooldown > 0) {
        ts = Math.round(+new Date() / 1000);
        if (ts > this.state_[sensor].cooldown) {
          if (this.debug_) {
            console.log('GPIO channel [' + this.state_[sensor].channel + '] cooldown period has expired.');
          }
          this.state_[sensor].cooldown = 0;
        }
      }
      if (this.state_[sensor].mode === 'auto' && override !== true) {
        disable = enable = false;
        if (this.state_[sensor].control === 'heater') {
          if (value > this.state_[sensor].sv && this.state_[sensor].gpio) {
            disable = true;
          } else if (value < this.state_[sensor].sv && !this.state_[sensor].gpio) {
            enable = true;
          }
        } else if (this.state_[sensor].control === 'chiller') {
          if (value > this.state_[sensor].sv && !this.state_[sensor].gpio) {
            enable = true;
          } else if (value < this.state_[sensor].sv && this.state_[sensor].gpio) {
            disable = true;
          }
        }
        if (enable === true) {
          if (this.state_[sensor].cooldown === 0) {
            if (this.debug_) {
              console.log('Enabling gpio channel: ' + this.state_[sensor].channel);
            }
            this.setGpio(sensor, true);
          }
        } else if (disable === true) {
          if (this.state_[sensor].cycle > 0) {
            if (this.debug_) {
              console.log('Setting cooldown for [' + this.state_[sensor].cycle + '] seconds on gpio channel [' + this.state_[sensor].channel + '].');
            }
            ts = Math.round(+new Date() / 1000);
            this.state_[sensor].cooldown = ts + this.state_[sensor].cycle;
          }
          if (this.debug_) {
            console.log('Disabling gpio channel: ' + this.state_[sensor].channel);
          }
          this.setGpio(sensor, false);
        }
      }
    };

    return Controller;

  })();

  module.exports = Controller;

}).call(this);
