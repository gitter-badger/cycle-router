# Cycle-Router

[![Join the chat at https://gitter.im/TylorS/cycle-router](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/TylorS/cycle-router?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This is a router driver for cycle.js built using the [addressbar](https://github.com/christianalfoni/addressbar) library. However if your browser does not support the history api it will switch to hashBang mode.

I would also suggest read this [article](http://www.christianalfoni.com/articles/2015_08_20_What-if-the-adddressbar-worked-like-an-input) or watching this [video](https://www.youtube.com/watch?v=W5U-NryY0Ns). They are both by the author of addressbar and have some really awesome ideas about routing, and are what I'm trying to make use of in this driver.


# Installation
`npm install cycle-router`

# Example
```javascript
import {run, Rx} from '@cycle/core';
import {h, makeDOMDriver} from '@cycle/dom';
import {makeRouterDriver} from 'cycle-router';

let Routes = {
  "authors": "/authors",
  "books": "/books",
  "books.view": "/books/view/:bookId",
  "books.view.chapter": "/books/view/:bookId/chapter/:chapterNum"
}

let Handlers = {
  "authors": () => "Authors",
  "books": () => "Books",
  "books.view": ({bookId}) => `BookId: ${bookId}`,
  "books.view.chapter": ({bookId, chapterNum}) => `BookId: ${bookId}, Chapter: ${chapterNum}`
};

function createView(text) {
  return h('div', [
    h('ul', [
      h('li',[h('a', {href: "/authors"}, 'Authors')]),
      h('li',[h('a', {href: "/books"}, 'Books')]),
      h('li',[h('a', {href: "/books/view/33"}, "Book 33")]),
      h('li',[h('a', {href: "/books/view/33/chapter/44"}, "Book 33 Chapter 44")])
    ]),
    h('h1', text)
  ]);
}

function HelloWorld() {
  return "Hello, World!";
}

function main({DOM, Router}) {
  Router
    .addRoutes(Routes)
    .addRoute('home', '/')
    .addHandlers(Handlers)
    .addHandler('home', HelloWorld);

  let currentRoute$ = DOM.select('a').events('click')
    .map(event => event.target.href)
    .startWith(location.href)
    .map(route => route);

  let view$ = Rx.Observable.combineLatest(
    Router.params$,
    Router.handlers$,
    (params, handler) => {
      if (handler) {
        return createView(handler(params));
      }
      return createView("Page can not be found");
    }
  );


  return {
    DOM: view$,
    Router: currentRoute$
  }
}

let drivers = {
  DOM: makeDOMDriver('.app'),
  Router: makeRouterDriver({
    hashBang: false // Default Behavior
  })
}

run(main, drivers);
```

# API

## Driver

### ```makeRouterDriver()```

###### Args
  hashBang: true|false (default: false)

###### Return

(Function) The Router Driver function. It expects an Observable of the current route you would like to set as input, and outputs an instance of Router.

## Router

#### Methods

####`addRoutes(routes)`
  Adds multipls routes from object, where keys should be the name of route, and values should be the path to match against.
  ```javascript
  Router.addRoutes({
    "authors": "/authors",
    "books": "/books",
    "books.view": "/books/view/:bookId",
    ...
  });
  ```
####`addRoute(name, path)`
  Adds a single route.

  ```javascript
  Router.addRoute("books", "/books");
  ```

####`on(name, handlerFn)`
  Listens for route change for route `name`.

  The handler function will be passed an object with any parameters defined in the route.

  ```javascript
  Router.on('books.view', ({bookId}) => {...});
  ```

####`setRoute(path)`
  Sets the route to `path`.
  Will trigger any subscriptions associated to the route.

  ```javascript
  Router.setRoute('/books')
  ```

#### Properties

#### `params$`
  This is an observable which emits an object with any parameters defined on the current route

  ```javascript
  Router.params$.map((params) => {...});
  ```
#### `handlers$`
  This is an observable which emits the register handler to the current route if present

  ```javascript
    Router.handler$((handlerFn) => handlerFn());
  ```
