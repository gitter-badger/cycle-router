'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _cycleCore = require('@cycle/core');

var _addressbar = require('addressbar');

var _addressbar2 = _interopRequireDefault(_addressbar);

function findMatchingRoute(routes, pathname) {
  return Object.keys(routes).filter(function (route) {
    return match(route, pathname);
  }).shift();
}

function match(route, pathname) {
  return asRegex(route).test(pathname);
}

function parseParams(route, pathname) {
  var urlValues = asRegex(route).exec(pathname);
  var dynamicSegments = asRegex(route).exec(route);
  var params = {};

  if (urlValues && dynamicSegments) {
    for (var i = 1; i < urlValues.length; i++) {
      params[dynamicSegments[i].substr(1)] = urlValues[i];
    }
  }
  return params;
}

function asRegex(route) {
  if (route === null || route === undefined) {
    route = "/";
  }
  var regexableRoute = '^' + route.replace(/:(\w+)/g, "(:?\\w+)") + '$';
  return new RegExp(regexableRoute, 'g');
}

function getPath(url) {
  var path = url.replace(window.location.origin, '').replace('/#!', '').replace('#!', '').split('');

  if (path.length > 1 && path[path.length - 1] === '/') {
    path.pop();
  }
  path = path.join('');

  return path;
}

function supportsHistoryAPI() {
  if (window.history && window.history.pushState) {
    return true;
  }

  return false;
}

function which(e) {
  e = e || window.event;
  return null === e.which ? e.button : e.which;
}

function sameOrigin(href) {
  var origin = location.protocol + '//' + location.hostname;
  if (location.port) origin += ':' + location.port;
  return href && 0 === href.indexOf(origin);
}

function onclick(e) {
  if (1 !== which(e)) return;

  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (e.defaultPrevented) return;

  // ensure link
  var el = e.target;
  while (el && 'A' !== el.nodeName) el = el.parentNode;
  if (!el || 'A' !== el.nodeName) return;

  // Ignore if tag has
  // 1. "download" attribute
  // 2. rel="external" attribute
  if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') return;

  // ensure non-hash for the same path
  var link = el.getAttribute('href');
  if (el.pathname === location.pathname && (el.hash || '#' === link)) return;

  // Check for mailto: in the href
  if (link && link.indexOf('mailto:') > -1) return;

  // check target
  if (el.target) return;

  // x-origin
  if (!sameOrigin(el.href)) return;

  // rebuild path
  var path = el.pathname + el.search + (el.hash || '');

  // strip leading "/[drive letter]:" on NW.js on Windows
  if (typeof process !== 'undefined' && path.match(/^\/[a-zA-Z]:\//)) {
    path = path.replace(/^\/[a-zA-Z]:\//, '/');
  }

  // All good
  e.preventDefault();
  return path;
}

function stealLinks() {
  var clickEvent = 'undefined' !== typeof document && document.ontouchstart ? 'touchstart' : 'click';
  return _cycleCore.Rx.Observable.fromEvent(document, clickEvent).map(onclick);
}

var Router = (function () {
  function Router(options) {
    _classCallCheck(this, Router);

    this.options = options || {
      hashBang: false
    };
    this.routes = {};
    this.subjects = {};
    this.handlers = {};

    // Catch All to subscribe to all params objects
    this.params$ = new _cycleCore.Rx.ReplaySubject(1);
    this.handlers$ = new _cycleCore.Rx.ReplaySubject(1);

    var self = this;
    if (supportsHistoryAPI() && options.hashBang === false) {
      // Also handle route changes on 'normal' link
      _addressbar2['default'].addEventListener('change', function (event) {
        // Don't handle links normally
        event.preventDefault();
        self.setRoute(event.target.value);
      });
    } else {
      var click$ = stealLinks();
      click$.subscribe(function (link) {
        if (link !== undefined) {
          self.setRoute(link);
        }
      });
    }

    // Should probably find a better way to support a 'notFound' route
    this.addRoute("notFound", "/ThisRouteDefinitelyIsNotFound");
  }

  /* Add an object with multiple routes
  **
  **  Router.addRoutes(
  **  {
  **    "home": "/",
  **    "contact": "/contact"
  **    "home.user": "/home/:userId"
  **  });
  */

  _createClass(Router, [{
    key: 'addRoutes',
    value: function addRoutes(routes) {
      var self = this;
      Object.keys(routes).forEach(function (routeName) {
        self.addRoute(routeName, routes[routeName]);
      });
      return this;
    }

    /* Add a single route
    **
    ** This sets up a new subject for each route
    ** that can be listened to.
    **
    ** When the route is matched it will emit a params object
    **
    ** Router.addRoute("home.user", "/home/:userId")
    */
  }, {
    key: 'addRoute',
    value: function addRoute(name, path) {
      var self = this;
      this.subjects[name] = new _cycleCore.Rx.Subject();
      this.routes[path] = function () {
        var params = parseParams(path, getPath(window.location.href));
        self.emit(name, params);
      };
      return this;
    }
  }, {
    key: 'addHandlers',
    value: function addHandlers(handlers) {
      var self = this;
      Object.keys(handlers).forEach(function (handlerName) {
        self.addHandler(handlerName, handlers[handlerName]);
      });
      return this;
    }
  }, {
    key: 'addHandler',
    value: function addHandler(name, handlerFn) {
      this.handlers[name] = handlerFn;
      return this;
    }

    /* Set the route
    **
    ** When set the route in the addressbar/omnibox
    ** is set to reflect your applications state.
    **
    ** If the route is found, the routes corresponding
    ** subject will emit the current params object
    **
    ** Router.setRoute("/home/123");
    */
  }, {
    key: 'setRoute',
    value: function setRoute(path) {
      var pathname = getPath(path);
      if (supportsHistoryAPI() && this.options.hashBang === false) {
        _addressbar2['default'].value = pathname;
      } else {
        location.href = "/#!" + pathname;
      }

      var route = findMatchingRoute(this.routes, pathname);
      var self = this;

      if (route !== null && route !== undefined && route !== window.location.href) {
        var params = parseParams(route, pathname);
        self.routes[route](params);
      } else {
        self.routes['/ThisRouteDefinitelyIsNotFound']({});
      }
    }

    /* Emits newest params object
    ** Also emits the handler function
    ** if one is associated with current route
    */
  }, {
    key: 'emit',
    value: function emit(name, data) {
      this.params$.onNext(data);

      var handler = this.handlers[name];

      if (handler !== null && handler !== undefined) {
        this.handlers$.onNext(handler);
      } else {
        this.handlers$.onNext(undefined);
      }
    }
  }]);

  return Router;
})();

function makeRouterDriver(options) {
  var router = new Router(options);

  // Takes an observable with the route you would like to set
  // Returns Router instance
  return function routerDriver(currentRoute$) {

    currentRoute$.subscribe(function onNext(route) {
      router.setRoute(route);
    });

    return router;
  };
}

exports['default'] = makeRouterDriver;
exports.makeRouterDriver = makeRouterDriver;
