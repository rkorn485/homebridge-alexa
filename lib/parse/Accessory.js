var debug = require('debug')('Accessory');
var Service = require('./Service.js').Service;
var messages = require('./messages.js');

module.exports = {
  Accessory: Accessory
};

/*
 * Homebridges -> Homebridge -> Accessory -> Service -> Characteristic
 */

function Accessory(devices, context) {
  // debug("Accessory", devices);
  this.aid = devices.aid;
  this.host = context.host;
  this.port = context.port;
  this.homebridge = context.homebridge;
  this.id = context.id;
  this.events = context.events;
  this.speakers = context.speakers;
  this.services = [];
  this.playback = false;
  this.television = false;
  this.link = [];
  devices.services.forEach(function(element) {
    // debug("Service", element);
    switch (element.type.substring(0, 8)) {
      case "0000003E": // Accessory Information
        this.info = information(element.characteristics);
        this.name = this.info.Name;
        break;
      default:
        var service = new Service(element, this);
        this.services[service.iid] = service;
        if (service.playback) {
          this.playback = true;
        }
        // debug("New", service.service);
        if (service.service === "Television") {
          // debug("Found TV", service.iid);
          this.television = true;
        }
        if (service.linked) {
          this.link[service.iid] = service.linked;
        }
    }
  }.bind(this));
  // debug("Info", this.info);
}

Accessory.prototype.toList = function(context) {
  var list = [];
  context.aid = this.aid;
  context.name = this.info.Name;
  context.manufacturer = this.info.Manufacturer;
  for (var index in this.services) {
    var service = this.services[index].toList(context);
    if (service) {
      list = list.concat(service);
    }
  }

  // debug("opt",context.opt,list.length);
  return (list);
};

Accessory.prototype.toAlexa = function(context) {
  var list = [];
  context.aid = this.aid;
  context.name = this.info.Name;
  context.manufacturer = this.info.Manufacturer;
  for (var index in this.services) {
    var service = this.services[index];
    if (service.linked) {
      // debug("Linked", this.services[index].linked.length);
      service.linked.forEach(function(link) {
      });
    }
    if (service.service === "Television") {
      // debug("Found Television", index, service.iid);
      this.tvService = service.toAlexa(context);
    } else if (this.television && service.service === "Speaker") {
      // debug("Found Speaker", index, service.iid);
      // debug("Speaker - cookie", service.toAlexa(context).cookie);
      // debug("Speaker - capabilities", service.toAlexa(context).capabilities);
      messages.mergeCookies(this.tvService.cookie, service.toAlexa(context).cookie);
      messages.mergeCapabilities(this.tvService.capabilities, service.toAlexa(context).capabilities);
    } else if (this.television && service.service === "Input Source") {
      // Skip Inputs for TV Accessories
    } else {
      list = list.concat(service.toAlexa(context));
    }
  }
  // debug("Insert", this.television, this.tvService);
  if (this.television && this.tvService) {
    list = list.concat(this.tvService);
  }
  // debug("opt",context.opt,list.length);
  return (list);
};

Accessory.prototype.toCookie = function(characteristic, context) {
  var list;
  context.aid = this.aid;
  context.name = this.info.Name;
  context.manufacturer = this.info.Manufacturer;
  for (var index in this.services) {
    var service = this.services[index].toCookie(characteristic, context);
    if (service) {
      list = service;
    }
  }

  // debug("opt",context.opt,list.length);
  return (list);
};

function information(characteristics) {
  var result = {};
  characteristics.forEach(function(characteristic) {
    if (characteristic.description) {
      var key = characteristic.description.replace(/ /g, '').replace(/\./g, '_');
      result[key] = characteristic.value;
    }
  });
  return result;
}