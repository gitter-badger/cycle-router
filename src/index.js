import {Rx} from '@cycle/core';
import addressbar from 'addressbar';

function findMatchingRoute(routes, pathname) {
  return Object.keys(routes).filter(function(route) {
    return match(route, pathname);
  }).shift();
}

function match (route, pathname) {
  return asRegex(route).test(pathname);
}

function parseParams(route, pathname) {
  let urlValues = asRegex(route).exec(pathname);
  let dynamicSegments = asRegex(route).exec(route);
  let params = {};

  if (urlValues && dynamicSegments) {
    for(let i = 1; i < urlValues.length; i++) {
      params[dynamicSegments[i].substr(1)] = urlValues[i];
    }
  }
  return params;
}

function asRegex(route) {
  if (route === null || route === undefined) {
    route = "/";
  }
  let regexableRoute = '^' + route.replace(/:(\w+)/g, "(:?\\w+)") + '$';
  return new RegExp(regexableRoute, 'g');
}

function getPath(url) {
  let path = url.replace(window.location.origin, '').replace('/#!', '').replace('#!', '').split('');

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
  return (href && (0 === href.indexOf(origin)));
}

function onclick(e) {
  console.log(e);

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
  var clickEvent = ('undefined' !== typeof document) && document.ontouchstart ? 'touchstart' : 'click';
  return Rx.Observable.fromEvent(document, clickEvent)
    .map(onclick);
}

class Router {

  constructor(options) {
    this.options = options || {
      hashBang: false
    }
    this.routes = {};
    this.subjects = {};
    this.handlers = {};

    // Catch All to subscribe to all params objects
    this.params$ = new Rx.ReplaySubject(1);
    this.handlers$ = new Rx.ReplaySubject(1);

    let self = this;
    if (supportsHistoryAPI() && this.options.hashBang === false) {
      // Also handle route changes on 'normal' link
      addressbar.addEventListener('change', function(event) {
        // Don't handle links normally
        event.preventDefault();
        self.setRoute(event.target.value);
      });
    } else {
      let click$ = stealLinks();
      click$.subscribe((link) => {
        self.setRoute(link);
      })
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
  addRoutes(routes) {
    let self = this;
    Object.keys(routes).forEach(function(routeName) {
      self.addRoute(routeName, routes[routeName]);
    })
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
  addRoute(name, path) {
    let self = this;
    this.subjects[name] = new Rx.Subject();
    this.routes[path] = function() {
      let params = parseParams(path, getPath(window.location.href));
      self.emit(name, params);
    }
    return this;
  }

  addHandlers(handlers) {
    let self = this;
    Object.keys(handlers).forEach(function(handlerName) {
      self.addHandler(handlerName, handlers[handlerName]);
    })
    return this;
  }

  addHandler(name, handlerFn) {
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
  setRoute(path) {
    let pathname = getPath(path);
    if (supportsHistoryAPI()) {
      addressbar.value = pathname;
    } else {
      window.location.hash = "#!" + pathname;
    }

    let route = findMatchingRoute(this.routes, pathname);
    let self = this;

    if (route !== null && route !== undefined && route !== window.location.href) {
      let params = parseParams(route, pathname);
      self.routes[route](params);
    } else {
      self.routes['/ThisRouteDefinitelyIsNotFound']({});
    }
  }

  /* Emits newest params object
  ** Also emits the handler function
  ** if one is associated with current route
  */
  emit(name, data) {
    this.params$.onNext(data);

    let handler = this.handlers[name];

    if (handler !== null && handler !== undefined) {
      this.handlers$.onNext(handler);
    } else {
      this.handlers$.onNext(undefined);
    }
  }
}

function makeRouterDriver(options) {
  let router = new Router(options);

  // Takes an observable with the route you would like to set
  // Returns Router instance
  return function routerDriver(currentRoute$) {

    currentRoute$.subscribe(
      function onNext(route) {
        router.setRoute(route);
      }
    );

    return router;
  }
}

export default makeRouterDriver;
export {makeRouterDriver};