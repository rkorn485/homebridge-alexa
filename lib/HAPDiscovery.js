var request = require('request');
var debug = require('debug')('Discovery');
var mdns = require('mdns');
var discovered = [];
// Globals
var pin;

module.exports = {
  HAPDiscovery: HAPDiscovery,
  HAPs: HAPs,
  HAPcontrol: HAPcontrol
};

function HAPDiscovery(options) {
  pin = options.pin;
  debug("Starting Homebridge Discovery");
  try {

      var sequence = [
          mdns.rst.DNSServiceResolve(),
          'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({
              families: [4]
          }),
          mdns.rst.makeAddressesUnique()
      ];
      var browser = mdns.createBrowser(mdns.tcp('hap'), {
          resolverSequence: sequence
      });
      browser.on('serviceUp', function(service) {
          debug("Found HAP device: %s http://%s:%s", service.name, service.host, service.port);
          _getAccessories(service.host, service.port, service.name, function(err, data) {
              if (!err) {
                  debug("HAP Discovered %s %s device(s)", service.name, Object.keys(data.accessories.accessories).length);
                  if (Object.keys(data.accessories.accessories).length > 0) {
                      discovered.push(data);
                  }
              } else {
                  // Error, no data
              }
          })
      });
      browser.on('serviceDown', function(service) {
          debug("HAP down: ", service.name);
      });
      browser.on('error', handleError);
      browser.start();
  } catch (ex) {
      handleError(ex);
  }
}



function HAPs() {
    return discovered;
}

// curl -X PUT http://127.0.0.1:51826/characteristics --header "Content-Type:Application/json"
// --header "authorization: 031-45-154" --data "{ \"characteristics\": [{ \"aid\": 2, \"iid\": 9, \"value\": 0}] }"

function HAPcontrol(host, port, body, callback) {

    request({
        method: 'PUT',
        url: 'http://' + host + ':' + port + '/characteristics',
        timeout: 10000,
        headers: {
            "Content-Type": "Application/json",
            "authorization": pin
        },
        body: body
    }, function(err, response) {
        // Response s/b 200 OK

        if (err || response.statusCode != 207) {
            debug("Homebridge Control failed %s:%s", host, port, body, err, response.body);
            //            deferred.reject("TCC Login failed, can't connect to TCC Web Site");
            callback(err);
        } else {
            try {
                json = JSON.parse(response.body);
            } catch (ex) {
                //                log.error(ex);
                debug("Homebridge Response Failed %s:%s", host, port, response.statusCode, response.statusMessage);
                debug("Homebridge Response Failed %s:%s", host, port, response.body);
                //                log.error(response);
                callback(new Error(ex));
            }
            callback(null, json);
        }
    });

}

function _getAccessories(host, port, hapname, callback) {

    var data = "";
    request({
        method: 'GET',
        url: 'http://' + host + ':' + port + '/accessories',
        timeout: 10000,
        json: true,
        headers: {
            "Content-Type": "Application/json",
            "authorization": pin,
            "connection": "keep-alive",
        },
    }, function(err, response, body) {
        // Response s/b 200 OK
        if (err || response.statusCode != 200) {
            if (err) {
                debug("HAP Discover failed http://%s:%s error %s", host, port, err.code);
            } else {
                // Status code = 401 = homebridge not running in insecure mode
                debug("HAP Discover failed http://%s:%s error code %s", host, port, response.statusCode);
                err = new Error("Http Err", response.statusCode);
            }
            callback(err);
        } else {
    //        debug("RESPONSE",body,Object.keys(body.accessories).length);
            if (Object.keys(body.accessories).length > 0) {
                callback(null, { "host": host, "port": port, "HBname": hapname, "accessories": body } );
            } else {
                debug("Short json data received http://%s:%s", host, port, JSON.stringify(body));
                callback(new Error("Short json data receivedh http://%s:%s", host, port));
            }
        }
    });
}

function handleError(err) {
    switch (err.errorCode) {
        case mdns.kDNSServiceErr_Unknown:
            console.warn(err);
            setTimeout(createBrowser, 5000);
            break;
        default:
            console.warn(err);
    }
}