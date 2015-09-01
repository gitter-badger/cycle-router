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
  let path = url.replace(window.location.origin, '').replace('/#', '').replace('#', '').split('');

  if (path.length > 1 && path[path.length - 1] === '/') {
    path.pop();
  }
  path = path.join('');

  return path;
}

class Router {

  constructor() {
    this.routes = {};
    this.subjects = {};

    // Catch All to subscribe to all params objects
    this.params$ = new Rx.ReplaySubject(1);

    let self = this;
    // Also handle route changes on 'normal' links
    addressbar.addEventListener('change', function(event) {
      // Don't handle links normally
      event.preventDefault();
      self.setRoute(event.target.value);
    });

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
    addressbar.value = pathname;
    let route = findMatchingRoute(this.routes, pathname);
    let self = this;
    if (route !== null && route !== undefined && route !== window.location.href) {
      let params = parseParams(route, pathname);
      self.routes[route](params);
    } else {
      self.routes['/ThisRouteDefinitelyIsNotFound']({});
    }
  }

  /* Listen for params object fo a given route name
  **
  ** Router.on('home', (params) => {
  **  console.log(params) ->  {userId: 122}
  **  ...do something...
  ** })
  */
  on(name, handlerFn) {
    this.subjects[name].subscribe(handlerFn);
    return this;
  }

  /* Emits newest params object to corresponding routes
  ** Also emits to params$
  **
  **
  */
  emit(name, data) {
    this.subjects[name].onNext(data);
    this.params$.onNext(data);
  }
}

function makeRouterDriver() {
  let router = new Router();

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